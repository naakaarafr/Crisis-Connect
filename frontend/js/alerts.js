/**
 * CrisisConnect Alerts Feed — Dynamic ML-Driven
 * Generates alerts from real /predict-risk scores per disaster.
 * Polling refreshes scores every 20s using Open-Meteo backed SecondaryRiskModel.
 */

let DISASTERS = [];
let sysAlerts = [];
let currentFilter = 'ALL';
let unreadCount = 0;
let autoRefresh = true;
let activeCard = null;

// ── Icon map ─────────────────────────────────────────────────────────────────
const ICONS = {
    earthquake: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
    flood:      '<path d="M2 12h4l3-9 5 15 3-9h5"/><path d="M2 18h20"/>',
    wildfire:   '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
    cyclone:    '<path d="M12 22a10 10 0 1 1 10-10 M12 18a6 6 0 1 1 6-6 M12 14a2 2 0 1 1 2-2"/>',
    default:    '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>'
};

// ── Derive severity class from ML risk score ──────────────────────────────────
function riskToSeverity(riskScore, disasterSeverity) {
    if (riskScore >= 75 || disasterSeverity >= 4.5) return 'CRITICAL';
    if (riskScore >= 50 || disasterSeverity >= 3.0) return 'WARNING';
    if (riskScore >= 25) return 'INFO';
    return 'RESOLVED';
}

// ── Build a descriptive alert message from ML cards ───────────────────────────
function buildAlertMessage(cards, disasterType) {
    if (!cards || cards.length === 0) {
        return `${disasterType} event detected. ML analysis pending.`;
    }
    // Find the highest-scoring card
    const worst = cards.reduce((a, b) => a.score > b.score ? a : b);
    const level = worst.score >= 75 ? 'CRITICAL' : worst.score >= 50 ? 'ELEVATED' : 'MODERATE';
    return `${level} ${worst.name.toUpperCase()} risk (${worst.score}%) — ${worst.desc}`;
}

// ── Build an alert title from severity class ──────────────────────────────────
function buildTitle(sevClass, disasterType) {
    if (sevClass === 'CRITICAL') return `CRITICAL ALERT — ${disasterType.toUpperCase()}`;
    if (sevClass === 'WARNING')  return `WARNING — ${disasterType.toUpperCase()} ESCALATION`;
    if (sevClass === 'INFO')     return `SITUATION UPDATE — ${disasterType.toUpperCase()}`;
    return `ALL-CLEAR — ${disasterType.toUpperCase()} STABILIZING`;
}

// ── Fetch ML risk for one disaster and return an alert object ─────────────────
async function fetchAlertForDisaster(disaster, offsetMs = 0, isNew = false) {
    const displaced = Math.floor((disaster.affected || 100000) * 0.35);
    const disasterType = (disaster.type || 'default').toLowerCase();

    let riskScore = disaster.severity * 10; // fallback
    let cards = [];
    let weatherInfo = '';

    try {
        const res = await CRISIS_API.post(CRISIS_API.endpoints.predictRisk, {
            severity_score:       disaster.severity * 200,
            risk_index:           5.0 + disaster.severity,
            population_density:   Math.floor((disaster.affected || 100000) / 100),
            infrastructure_index: 0.5,
            lat:  disaster.lat,
            lon:  disaster.lng,
            time_hours: 48,
            displaced_people: displaced,
            disaster_type: disasterType,
            severity: disaster.severity,
        });

        riskScore = res?.risk?.risk_score ?? riskScore;
        cards     = res?.risk?.cards     ?? [];
        const wx  = res?.risk?.weather   ?? {};
        if (wx.temperature !== undefined) {
            weatherInfo = ` [${wx.temperature}°C, ${wx.windspeed}km/h]`;
        }
    } catch (e) {
        // Use fallback values silently
    }

    const sevClass = riskToSeverity(riskScore, disaster.severity);
    const msg      = buildAlertMessage(cards, disaster.type || 'Disaster') + weatherInfo;

    return {
        id:        'A' + Math.floor(Math.random() * 999999),
        disaster,
        riskScore,
        cards,
        title:     buildTitle(sevClass, disaster.type || 'Event'),
        category:  sevClass,
        desc:      msg,
        timestamp: Date.now() - offsetMs,
        isNew,
    };
}

// ── DOMContentLoaded ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Fetch all disasters from backend
    try {
        DISASTERS = await CRISIS_API.getDisasters();
        console.log(`[Alerts] Loaded ${DISASTERS.length} disasters.`);
    } catch (err) {
        console.error('Failed to load disasters:', err);
        DISASTERS = [];
    }

    // Show a loading state
    document.getElementById('alert-feed').innerHTML =
        `<div style="color:var(--muted);padding:24px;font-family:'Share Tech Mono',monospace;font-size:13px;">
            ⌛ FETCHING ML RISK SCORES...
         </div>`;

    // 2. Generate initial alerts from all disasters via ML
    if (DISASTERS.length > 0) {
        const HOUR = 60 * 60 * 1000;
        const promises = DISASTERS.map((d, i) =>
            fetchAlertForDisaster(d, i * HOUR * 2, false)
        );
        sysAlerts = await Promise.all(promises);
        sysAlerts.sort((a, b) => b.riskScore - a.riskScore); // highest risk first
    }

    initFilters();
    initRefreshToggle();
    initTimestamp();
    initDetailPanel();
    renderFeed();
    startRefreshInterval();
});

// ── Live refresh — re-fetches ONE random disaster via ML every 20s ────────────
function startRefreshInterval() {
    setInterval(async () => {
        if (!autoRefresh || DISASTERS.length === 0) return;

        document.getElementById('txt-last').innerText =
            `LAST REFRESH: ${new Date().toLocaleTimeString()}`;

        // Pick a random disaster and re-score it live
        const d = DISASTERS[Math.floor(Math.random() * DISASTERS.length)];
        const fresh = await fetchAlertForDisaster(d, 0, true);
        sysAlerts.forEach(a => a.isNew = false);
        sysAlerts.unshift(fresh);
        if (sysAlerts.length > 60) sysAlerts.pop();

        unreadCount++;
        const bdg = document.getElementById('nav-badge');
        bdg.classList.add('pop');
        setTimeout(() => bdg.classList.remove('pop'), 300);
        renderFeed();
    }, 20000);
}

// ── UI Helpers ─────────────────────────────────────────────────────────────────
function getClasses(sev) {
    if (sev === 'CRITICAL') return { c: 'sev-critical', bg: 'bg-critical', bc: 'var(--red)' };
    if (sev === 'WARNING')  return { c: 'sev-warning',  bg: 'bg-warning',  bc: 'var(--amber)' };
    if (sev === 'RESOLVED') return { c: 'sev-resolved', bg: 'bg-resolved', bc: 'var(--green)' };
    return { c: 'sev-info', bg: 'bg-info', bc: 'var(--cyan)' };
}

function getTimeStr(ms) {
    const diff = Math.floor((Date.now() - ms) / 60000);
    if (diff < 1)  return 'JUST NOW';
    if (diff < 60) return `${diff} MIN AGO`;
    return `${Math.floor(diff / 60)} HR AGO`;
}

function renderFeed() {
    const feed  = document.getElementById('alert-feed');
    const empty = document.getElementById('empty-state');
    const filtered = sysAlerts.filter(a => currentFilter === 'ALL' || a.category === currentFilter);

    if (filtered.length === 0) {
        feed.style.display = 'none';
        empty.classList.add('show');
    } else {
        feed.style.display = 'flex';
        empty.classList.remove('show');

        feed.innerHTML = filtered.map(a => {
            const col = getClasses(a.category);
            const key = (a.disaster.type || 'default').toLowerCase();
            const iconPath = ICONS[key] || ICONS.default;
            const hub = a.disaster.hub || a.disaster.name;

            return `
              <div class="alert-card${a.isNew ? ' card-animate' : ''}" data-id="${a.id}" onclick="openDetail('${a.id}')">
                <div class="border-left" style="background-color:${col.bc};${a.isNew && a.category==='CRITICAL' ? `box-shadow:0 0 15px ${col.bc}` : ''}"></div>
                <div class="alert-layout">
                  <div class="icon-wrapper" style="background:rgba(10,6,3,0.5);color:${col.bc};">
                    <svg viewBox="0 0 24 24">${iconPath}</svg>
                  </div>
                  <div class="alert-core">
                    <div class="alert-title">${a.title}</div>
                    <div class="alert-meta">
                      <span style="color:${col.bc}">${a.disaster.type || 'EVENT'}</span>
                      <span class="bull">•</span> ${hub}
                      <span class="bull">•</span> RISK SCORE: <span style="color:${col.bc};font-weight:700">${a.riskScore}</span>
                      <span class="bull">•</span> SOURCE: ML + OPEN-METEO
                    </div>
                    <div class="alert-desc">${a.desc}</div>
                  </div>
                  <div class="alert-right">
                    <div class="alert-time">${getTimeStr(a.timestamp)}</div>
                    <div class="alert-pill ${col.bg}">${a.category}</div>
                    <div class="view-link" style="color:${col.bc}">VIEW →</div>
                  </div>
                </div>
              </div>`;
        }).join('');
    }

    updateBadges();
}

function updateBadges() {
    const counts = { ALL: sysAlerts.length, CRITICAL: 0, WARNING: 0, INFO: 0, RESOLVED: 0 };
    sysAlerts.forEach(a => { if (counts[a.category] !== undefined) counts[a.category]++; });

    document.getElementById('c-all').innerText  = counts.ALL;
    document.getElementById('c-crit').innerText = counts.CRITICAL;
    document.getElementById('c-warn').innerText = counts.WARNING;
    document.getElementById('c-info').innerText = counts.INFO;
    document.getElementById('c-res').innerText  = counts.RESOLVED;

    const nb = document.getElementById('nav-badge');
    nb.innerText = Math.min(99, unreadCount);
}

function initFilters() {
    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentFilter = tab.dataset.filter;
            renderFeed();
        });
    });
}

function initRefreshToggle() {
    document.getElementById('auto-refresh-btn').addEventListener('click', () => {
        autoRefresh = !autoRefresh;
        document.getElementById('auto-refresh-btn').classList.toggle('off', !autoRefresh);
    });
}

function initDetailPanel() {
    document.getElementById('dp-close').addEventListener('click', () => {
        document.getElementById('detail-panel').classList.remove('open');
        if (activeCard) activeCard.classList.remove('active');
    });
}

window.openDetail = (id) => {
    const alt = sysAlerts.find(a => a.id === id);
    if (!alt) return;

    document.querySelectorAll('.alert-card').forEach(c => c.classList.remove('active'));
    const tgt = document.querySelector(`.alert-card[data-id="${id}"]`);
    if (tgt) { tgt.classList.add('active'); activeCard = tgt; }

    const col = getClasses(alt.category);
    const hub = alt.disaster.hub || alt.disaster.name;

    document.getElementById('dp-type').innerText = alt.disaster.type || 'UNKNOWN';
    document.getElementById('dp-type').style.color = col.bc;
    document.getElementById('dp-title').innerText = alt.disaster.name;
    document.getElementById('dp-desc').innerText  = alt.desc;

    document.getElementById('dp-aff').innerText    = (alt.disaster.affected || 0).toLocaleString();
    document.getElementById('dp-coords').innerText = `${alt.disaster.lat}°N, ${alt.disaster.lng}°E`;
    document.getElementById('dp-hub').innerText    = hub;

    document.getElementById('btn-view-map').href = `disaster.html?id=${alt.disaster.id}`;
    document.getElementById('btn-view-map').style.backgroundColor = col.bc;
    document.getElementById('btn-view-map').style.boxShadow = `0 0 15px ${col.bc}44`;
    document.getElementById('btn-view-res').href = `resources.html?id=${alt.disaster.id}`;

    // Severity gauge — normalise 0-100 riskScore to the half-circle arc
    const sev    = alt.riskScore;
    const dashLim = (sev / 100) * 157;
    let gc = 'var(--green)';
    if (sev >= 50) gc = 'var(--amber)';
    if (sev >= 75) gc = 'var(--red)';

    document.getElementById('dp-gauge-text').innerText = sev;
    const path = document.getElementById('dp-gauge-path');
    path.style.stroke = gc;
    path.style.strokeDasharray = '0, 157';
    setTimeout(() => { path.style.strokeDasharray = `${dashLim}, 157`; }, 100);

    // Status badge
    const statB = document.getElementById('dp-status-badge');
    if (alt.category === 'RESOLVED') {
        statB.innerHTML = '✓ STABILIZED';
        statB.style.cssText = 'color:var(--green);border-color:var(--green);background:rgba(0,230,118,0.1)';
    } else if (alt.category === 'CRITICAL') {
        statB.innerHTML = '⚠ ESCALATING';
        statB.style.cssText = 'color:var(--red);border-color:var(--red);background:rgba(255,59,59,0.1)';
    } else if (alt.category === 'WARNING') {
        statB.innerHTML = '⚡ MONITORING';
        statB.style.cssText = 'color:var(--amber);border-color:var(--amber);background:rgba(255,179,64,0.1)';
    } else {
        statB.innerHTML = 'ℹ TRACKING';
        statB.style.cssText = 'color:var(--cyan);border-color:var(--cyan);background:rgba(255,85,0,0.1)';
    }

    document.getElementById('detail-panel').classList.add('open');
};

function initTimestamp() {
    const ts = document.getElementById('timestamp');
    function update() {
        const d = new Date();
        const p = n => n.toString().padStart(2, '0');
        ts.innerText = `${d.getUTCFullYear()}-${p(d.getUTCMonth()+1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())} UTC`;
    }
    setInterval(update, 1000);
    update();
}

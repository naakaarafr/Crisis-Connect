/**
 * CrisisConnect Secondary Risk Assessment Logic
 * Fetches real risk scores from /predict-risk and /predict-hotspots via ML backend.
 */

let d = null;

// Dynamic Risk Card definitions are now streamed directly from the Python ML backend.

let map;
let _apiData = null; // store fetched API response

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const paramId = parseInt(urlParams.get('id'));

    // ── 1. Fetch ALL disasters and populate the dropdown ──────────────────────
    let all_disasters = [];
    try {
        all_disasters = await CRISIS_API.getDisasters();
        d = paramId
            ? await CRISIS_API.getDisasterById(paramId)
            : all_disasters[0];
    } catch (err) {
        console.error('Failed to fetch disasters:', err);
    }

    if (!d) {
        d = { id: 9999, name: 'Synthetic Crisis Event', lat: 25.2, lng: 55.3,
              severity: 4.5, affected: 200000, type: 'Earthquake' };
        all_disasters.push(d);
    }

    const selectEl = document.getElementById('event-selector');
    if (selectEl) {
        selectEl.innerHTML = all_disasters.map(ev =>
            `<option value="${ev.id}" ${ev.id == d.id ? 'selected' : ''}>${ev.name}</option>`
        ).join('');
        selectEl.addEventListener('change', (e) => {
            window.location.search = '?id=' + e.target.value;
        });
        
        // Initialize Searchable Dropdown
        if (typeof TomSelect !== 'undefined') {
            new TomSelect(selectEl, {
                create: false,
                sortField: { field: "text", direction: "asc" },
                dropdownParent: 'body'
            });
        }
    }

    initMap(d);
    initTimestamp();

    // ── 2. Fetch ML data and render ───────────────────────────────────────────
    await fetchAndRenderRisk();
    startRealtimePoll();
});

async function fetchAndRenderRisk() {
    if (!d) return;
    const displaced = Math.floor((d.affected || 200000) * 0.35);
    const disasterType = (d.type || 'default').toLowerCase();

    let apiRisk = null;
    try {
        const backendOk = typeof CRISIS_API !== 'undefined' && await CRISIS_API.isAvailable().catch(() => false);
        if (backendOk) {
            const basePayload = {
                severity_score:       d.severity * 200,
                risk_index:           5.0 + d.severity,
                population_density:   Math.floor((d.affected || 200000) / 100),
                infrastructure_index: 0.5,
                lat:  d.lat,
                lon:  d.lng,
                time_hours: 48,
                displaced_people: displaced,
                disaster_type: disasterType,
                severity: d.severity,
            };

            // Parallel: risk cards + hotspot map markers
            const [riskRes, spotsRes] = await Promise.allSettled([
                CRISIS_API.post(CRISIS_API.endpoints.predictRisk, basePayload),
                CRISIS_API.post(CRISIS_API.endpoints.predictSpots, {
                    ...basePayload,
                    coordinates: [
                        [d.lat,        d.lng       ],
                        [d.lat + 0.4,  d.lng + 0.3 ],
                        [d.lat - 0.3,  d.lng + 0.4 ],
                        [d.lat + 0.2,  d.lng - 0.3 ],
                    ]
                })
            ]);

            if (riskRes.status === 'fulfilled') {
                apiRisk = riskRes.value;
                _apiData = apiRisk;

                // Show live weather badge
                const wx = apiRisk?.risk?.weather || {};
                const weatherBadge = document.getElementById('weather-badge');
                if (weatherBadge && wx.temperature !== undefined) {
                    weatherBadge.textContent =
                        `🌡 ${wx.temperature}°C  💨 ${wx.windspeed} km/h  WMO:${wx.weathercode}`;
                }
            }

            if (spotsRes.status === 'fulfilled') {
                addHotspotMarkers(spotsRes.value.hotspots || []);
            }
        }
    } catch(e) {
        console.warn('[CrisisConnect] Risk API unavailable:', e.message);
    }

    const risks = buildRiskCards(apiRisk);
    renderGrid(risks);
}

function startRealtimePoll() {
    setInterval(fetchAndRenderRisk, 30000); // 30s live refresh
}

/**
 * Build risk card data array directly from dynamic API payloads.
 * Evaluates real-time meteorology passed by backend.
 */
function buildRiskCards(apiRisk) {
    // If backend ML drops offline somehow, inject safe fallbacks
    let dynamicCards = [];
    if (apiRisk && apiRisk.risk && apiRisk.risk.cards) {
        dynamicCards = apiRisk.risk.cards;
    } else {
        // Fallback safety if model refuses
        dynamicCards = [
            { id:'disease', name: 'Disease Outbreak', score: 45, icon: '<path d="M12 2v2M12 20v2M5 5l1.5 1.5M17.5 17.5L19 19M2 12h2M20 12h2M5 19l1.5-1.5M17.5 6.5L19 5"/>', desc: 'Connectivity error to ML processing core.' }
        ];
    }

    return dynamicCards.map(def => {
        const score = def.score || 0;
        let level, cBg, tMsg, tIco, tCol;

        if (score >= 80) {
            level = 'CRITICAL'; cBg = 'var(--red)'; tCol = 'var(--red)';
            tMsg = `↑ Critical level — immediate intervention required`;
            tIco = '<path d="M12 19V5M5 12l7-7 7 7"/>';
        } else if (score >= 60) {
            level = 'HIGH'; cBg = 'var(--amber)'; tCol = 'var(--amber)';
            tMsg = `↑ Elevated — active monitoring needed`;
            tIco = '<path d="M12 19V5M5 12l7-7 7 7"/>';
        } else if (score >= 40) {
            level = 'MEDIUM'; cBg = '#2979ff'; tCol = '#2979ff';
            tMsg = `→ Stable — continues to be tracked`;
            tIco = '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>';
        } else {
            level = 'LOW'; cBg = 'var(--green)'; tCol = 'var(--green)';
            tMsg = `↓ Contained — improving conditions`;
            tIco = '<path d="M12 5v14M5 12l7 7 7-7"/>';
        }

        const mlLabel = _apiData ? ' · Open-Meteo Synced' : '';
        return { ...def, score, level, cBg, cBorder: cBg, tMsg: tMsg + mlLabel, tIco, tCol };
    });
}

function addHotspotMarkers(hotspots) {
    if (!map || !hotspots.length) return;
    hotspots.forEach(h => {
        L.circleMarker([h.lat, h.lon], {
            radius: 8 + h.intensity * 6,
            color: '#ff3b3b',
            fillColor: '#ff3b3b',
            fillOpacity: 0.5,
            weight: 1,
        }).bindPopup(`<b>ML Hotspot</b><br>Intensity: ${(h.intensity * 100).toFixed(0)}%<br>Est. population: ${(h.population_estimate || 0).toLocaleString()}`).addTo(map);
    });
}

function initMap(d) {
    map = L.map('map', {
      zoomControl: false, attributionControl: false,
      dragging: false, scrollWheelZoom: false, doubleClickZoom: false
    }).setView([d.lat, d.lng], 7);

    L.tileLayer('https://cartodb-basemaps-{s}.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

    // Heatmap centred on the disaster — stays even without API
    const intensity = d.severity * 0.2;
    const hPoints = [[d.lat, d.lng, Math.min(1.0, intensity * 1.5)]];
    const offsets = [
        [0.5, 0.3], [-0.4, 0.4], [0.3, -0.5], [-0.2, -0.3],
        [0.7, 0.1], [-0.6, 0.2], [0.1, 0.8], [-0.1, -0.7],
    ];
    offsets.forEach(([dlat, dlng]) => hPoints.push([d.lat + dlat, d.lng + dlng, intensity * 0.6]));

    L.heatLayer(hPoints, {
        radius: 40, blur: 35,
        gradient: {0.2:'#FF5500', 0.4:'#00e676', 0.6:'#b2ff59', 0.8:'#ffb340', 1.0:'#ff3b3b'}
    }).addTo(map);
}

function renderGrid(risks) {
    const svgPathLength = 157;
    const gridHtml = risks.map(r => {
      const dashLimit = (r.score / 100) * svgPathLength;
      return `
        <div class="risk-card">
          <div class="risk-border-left" style="background-color: ${r.cBorder}; box-shadow: 0 0 10px ${r.cBorder};"></div>
          <div class="risk-header">
            <div class="risk-head-left"><svg viewBox="0 0 24 24">${r.icon}</svg><h3 class="risk-title">${r.name}</h3></div>
            <div class="risk-badge" style="background-color: ${r.cBg}">${r.level}</div>
          </div>
          <div class="gauge-container">
            <svg class="gauge-svg" viewBox="0 0 120 70">
              <path class="gauge-arc-bg" d="M 10,60 A 50,50 0 0,1 110,60" />
              <path class="gauge-arc-fill" style="stroke: ${r.tCol || r.cBg}" d="M 10,60 A 50,50 0 0,1 110,60" data-dash="${dashLimit}" />
              <text class="gauge-text" x="60" y="55">${r.score}%</text>
            </svg>
          </div>
          <div class="risk-footer">
            <div class="risk-trend" style="color: ${r.tCol};"><span class="trend-arrow"><svg viewBox="0 0 24 24">${r.tIco}</svg></span>${r.tMsg}</div>
            <p class="risk-desc">${r.desc}</p>
          </div>
        </div>`;
    }).join('');

    document.getElementById('grid').innerHTML = gridHtml;

    setTimeout(() => {
      document.querySelectorAll('.gauge-arc-fill').forEach(path => {
        path.style.strokeDasharray = `${path.dataset.dash}, 157`;
      });
    }, 200);
}

function initTimestamp() {
    const ts = document.getElementById('timestamp');
    function update() {
      const date = new Date();
      const p = n => n.toString().padStart(2, '0');
      ts.innerText = `${date.getUTCFullYear()}-${p(date.getUTCMonth()+1)}-${p(date.getUTCDate())} ${p(date.getUTCHours())}:${p(date.getUTCMinutes())}:${p(date.getUTCSeconds())} UTC`;
    }
    setInterval(update, 1000);
    update();
}

/**
 * CrisisConnect Dashboard Logic
 * Handles Globe.gl 3D map initialization, disaster markers, and UI overlays.
 */

let DISASTERS = [];

let globe;
let heatmapActive = false;

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Fetch dynamic disasters from ML backend
    try {
        const data = await CRISIS_API.getDisasters();
        DISASTERS = data || [];
        console.log(`[Dashboard] Loaded ${DISASTERS.length} dynamic disasters.`);
    } catch (err) {
        console.error("Failed to load disasters from backend, using empty list.", err);
        DISASTERS = [];
    }

    initGlobe();
    updateStats();
    initControls();
    initFeed();
    startRealtimePoll(); // Poll ML backend for live stats
});

function initGlobe() {
    const mapEl = document.getElementById('map');
    // Ensure parent is styled so canvas covers it cleanly
    mapEl.style.backgroundColor = '#000000';

    globe = Globe()(mapEl)
        .globeImageUrl('https://unpkg.com/three-globe/example/img/earth-dark.jpg')
        .backgroundImageUrl('https://unpkg.com/three-globe/example/img/night-sky.png')
        .showAtmosphere(true)
        .atmosphereColor('#ff4400')
        .atmosphereAltitude(0.15)
        .polygonAltitude(0.01)
        .polygonSideColor(() => 'rgba(200, 50, 0, 0.1)')
        .polygonStrokeColor(() => '#ff6600');

    // Color schema for threat tracking aesthetic
    const tl = {
        'Algeria': '#114411', 'Mali': '#114411', 'Libya': '#882200', 'Egypt': '#551100', 'Sudan': '#cc4400',
        'Saudi Arabia': '#882200', 'Iran': '#cc4400', 'Turkey': '#cc4400', 'Syria': '#882200', 'France': '#cc4400',
        'Germany': '#ff8800', 'Ukraine': '#cc4400', 'Italy': '#551100'
    };
    const cPal = ['#1a331a', '#802b00', '#ba3800', '#1c1c1c'];

    fetch('https://unpkg.com/world-atlas@2/countries-110m.json')
        .then(res => res.json())
        .then(worldData => {
            const countries = topojson.feature(worldData, worldData.objects.countries).features;
            globe.polygonsData(countries)
                .polygonCapColor(d => {
                    const nm = d.properties.NAME || d.properties.name;
                    if (tl[nm]) return tl[nm];
                    return cPal[(nm ? nm.charCodeAt(0) + nm.charCodeAt(nm.length - 1) : 0) % cPal.length];
                });
        });

    globe.controls().autoRotate = true;
    globe.controls().autoRotateSpeed = 0.5;

    renderDisasterLayers();

    // Adjust widget canvas resizer properly
    window.addEventListener('resize', () => {
        globe.width(mapEl.clientWidth).height(mapEl.clientHeight);
    });
    setTimeout(() => globe.width(mapEl.clientWidth).height(mapEl.clientHeight), 100);

    // Initial View over Eurasia / Middle East
    globe.pointOfView({ lat: 25, lng: 45, altitude: 2.2 });
}

function renderDisasterLayers() {
    if (heatmapActive) {
        // Render Heatmap using highly saturated blurred rings
        globe.htmlElementsData([]);

        let heatData = [];
        // Deterministic offsets so render is stable (no flicker on repaint)
        const OFFSETS = [[2, 3], [-2, 3], [2, -3], [-2, -3]];
        DISASTERS.forEach(d => {
            const intensity = d.severity; // 1-5
            heatData.push({ lat: d.lat, lng: d.lng, maxR: intensity * 2, color: intensity >= 4 ? '#ff003c' : '#ff8800' });
            OFFSETS.forEach(([dlat, dlng]) => {
                heatData.push({
                    lat: d.lat + dlat,
                    lng: d.lng + dlng,
                    maxR: intensity * 1.5,
                    color: intensity >= 4 ? '#ff2200' : '#ff6600'
                });
            });
        });

        globe.ringsData(heatData)
            .ringColor('color')
            .ringMaxRadius('maxR')
            .ringPropagationSpeed(1.5)
            .ringRepeatPeriod(600);

    } else {
        // Render functional interactive HTML markers replacing Leaflet divIcons
        globe.ringsData([]);

        globe.htmlElementsData(DISASTERS)
            .htmlElement(d => {
                const el = document.createElement('div');
                let sevClass = d.severity === 5 ? 'sev-5' : (d.severity >= 3 ? 'sev-3' : 'sev-1');
                el.innerHTML = `
                     <div class="pulse-marker ${sevClass}" style="transform: translate(-50%, -50%); cursor:pointer;">
                         <div class="pulse-ring"></div>
                         <div class="pulse-dot"></div>
                         <div class="marker-label" style="pointer-events:none;">${d.name}</div>
                     </div>
                 `;
                el.style.pointerEvents = 'auto';
                el.onclick = () => {
                    showSlidePanel(d, sevClass);
                    globe.pointOfView({ lat: d.lat, lng: d.lng, altitude: 1.2 }, 1000);
                };
                return el;
            });
    }
}

function updateStats(mlData = null) {
    const activeEl = document.getElementById('stat-active');
    const affectedEl = document.getElementById('stat-affected');
    const driftEl = document.getElementById('stat-drift');
    const hotspotEl = document.getElementById('stat-hotspots');
    const riskEl = document.getElementById('stat-risk');

    if (!activeEl) return;

    // Base stats from mock list
    activeEl.innerText = DISASTERS.length;

    if (mlData) {
        // Enriched stats from ML backend
        affectedEl.innerText = Math.round(mlData.displacement || 0).toLocaleString();
        driftEl.innerText = Math.round(mlData.drift?.search_radius_km || 0) + ' km';
        hotspotEl.innerText = (mlData.hotspots?.length || 0);
        riskEl.innerText = Math.round(mlData.risk?.risk_score || 0) + '%';

        // Dynamic coloring for risk
        const score = mlData.risk?.risk_score || 0;
        riskEl.className = `stat-value data-font ${score > 70 ? 'val-red' : (score > 40 ? 'val-amber' : 'val-cyan')}`;
    } else {
        // Fallback/Initial state
        const totalAffected = DISASTERS.reduce((s, d) => s + d.affected, 0);
        affectedEl.innerText = totalAffected.toLocaleString();
        driftEl.innerText = '-';
        hotspotEl.innerText = '-';
        riskEl.innerText = '-';
    }

    [activeEl, affectedEl, driftEl, hotspotEl, riskEl].forEach(el => {
        if (!el) return;
        el.style.animation = 'none';
        el.offsetHeight;
        el.style.animation = 'flicker 2s';
    });
}

/**
 * Trigger a real-time ML prediction using the full pipeline.
 */
async function runManualPrediction() {
    const loader = document.getElementById('ml-loading-bar');
    const statusText = document.querySelector('.status-bar div:last-child');
    const refreshBtn = document.getElementById('btn-refresh');
    const svg = refreshBtn?.querySelector('svg');

    if (loader) loader.style.display = 'block';
    if (svg) svg.style.animation = 'spin 1s linear infinite';
    if (statusText) statusText.innerHTML = '● RUNNING ML PIPELINE...';

    try {
        // Use standard context for dashboard-level prediction
        const payload = {
            severity_score: 4.0,
            risk_index: 5.5,
            population_density: 150000,
            infrastructure_index: 0.4,
            lat: 25.0,
            lon: 45.0,
            wind_speed: 18,
            wind_dir: 140,
            current_speed: 1.2,
            current_dir: 90,
            time_hours: 48,
            // Extended payload for dashboard visibility
            coordinates: [[25.0, 45.0], [25.5, 45.5]],
            source: 0,
            target: 1
        };

        const result = await CRISIS_API.runFullPipeline(payload);
        updateStats(result);
        if (statusText) statusText.innerHTML = '● ML PIPELINE COMPLETE';
    } catch (err) {
        console.error('Prediction failed:', err);
        if (statusText) statusText.innerHTML = `<span style="color:var(--red)">● ML PIPELINE ERROR: ${err.message}</span>`;
    }
}

/**
 * Demo Flow: Simulate a catastrophic event in Istanbul.
 */
async function runDemoSimulation() {
    const hud = document.getElementById('scanning-hud');
    const coordEl = document.getElementById('scan-coords');
    const statusText = document.querySelector('.status-bar div:last-child');

    // 1. Show HUD and Fly to Istanbul
    if (hud) hud.style.display = 'flex';
    if (statusText) statusText.innerHTML = '● ANALYZING ISTANBUL THREAT VECTORS...';

    globe.pointOfView({ lat: 41.0082, lng: 28.9784, altitude: 0.8 }, 2000);

    // Simulate coord scanning effect
    let scanIntv = setInterval(() => {
        if (coordEl) {
            const l1 = (41 + Math.random() * 0.1).toFixed(4);
            const l2 = (29 + Math.random() * 0.1).toFixed(4);
            coordEl.innerText = `LAT: ${l1} | LON: ${l2}`;
        }
    }, 100);

    try {
        const payload = {
            severity_score: 8.5,
            risk_index: 9.2,
            population_density: 15400000,
            infrastructure_index: 0.25,
            lat: 41.0082,
            lon: 28.9784,
            wind_speed: 12,
            wind_dir: 180,
            current_speed: 0.8,
            current_dir: 45,
            time_hours: 72,
            coordinates: [[41.00, 28.97], [41.05, 29.02]],
            source: 0,
            target: 1,
            disaster_type: 'earthquake'
        };

        const result = await CRISIS_API.runFullPipeline(payload);

        // Brief pause for dramatic effect
        await new Promise(r => setTimeout(r, 1500));

        updateStats(result);
        if (statusText) statusText.innerHTML = '● DEMO SIMULATION COMPLETE';
    } catch (err) {
        if (statusText) statusText.innerHTML = `<span style="color:var(--red)">● DEMO FAILURE: ${err.message}</span>`;
    } finally {
        clearInterval(scanIntv);
        if (hud) hud.style.display = 'none';
        setTimeout(() => {
            if (statusText && !statusText.innerHTML.includes('FAILURE')) {
                statusText.innerHTML = '● CRISISCONNECT v1.0 | GLOBAL DISASTER INTELLIGENCE';
            }
        }, 5000);
    }
}

function initControls() {
    const btnHeatmap = document.getElementById('btn-heatmap');
    if (btnHeatmap) {
        btnHeatmap.addEventListener('click', function () {
            heatmapActive = !heatmapActive;
            if (heatmapActive) {
                this.classList.add('active');
                this.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12c0 5.52-4.48 10-10 10S2 17.52 2 12 6.48 2 12 2s10 4.48 10 10z"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="7" stroke-opacity="0.5"/></svg> HEATMAP ON';
            } else {
                this.classList.remove('active');
                this.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12c0 5.52-4.48 10-10 10S2 17.52 2 12 6.48 2 12 2s10 4.48 10 10z"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="7" stroke-opacity="0.5"/></svg> HEATMAP OFF';
            }
            renderDisasterLayers();
        });
    }

    const btnFit = document.getElementById('btn-fit');
    if (btnFit) {
        btnFit.addEventListener('click', () => {
            globe.pointOfView({ lat: 25, lng: 45, altitude: 2.2 }, 1500);
        });
    }

    const btnDemo = document.getElementById('btn-demo-sim');
    if (btnDemo) {
        btnDemo.addEventListener('click', () => {
            runDemoSimulation();
        });
    }

    const btnRefresh = document.getElementById('btn-refresh');
    if (btnRefresh) {
        btnRefresh.addEventListener('click', () => {
            runManualPrediction();
        });
    }

    const closePanel = document.getElementById('close-panel');
    if (closePanel) {
        closePanel.addEventListener('click', () => {
            document.getElementById('disaster-panel').classList.remove('show');
        });
    }
}

function showSlidePanel(d, sevClass) {
    const panel = document.getElementById('disaster-panel');
    document.getElementById('p-title').innerText = d.name;

    const typeBadge = document.getElementById('p-type');
    typeBadge.innerText = d.type;
    typeBadge.className = `badge-pill ${d.severity === 5 ? 'badge-red' : (d.severity >= 3 ? 'badge-amber' : 'badge-cyan')}`;

    const sevContainer = document.getElementById('p-severity');
    sevContainer.innerHTML = '';
    for (let i = 1; i <= 5; i++) {
        const block = document.createElement('div');
        block.className = 'sev-block';
        if (i <= d.severity) {
            if (d.severity === 5) block.classList.add('filled-red');
            else if (d.severity >= 3) block.classList.add('filled-amber');
            else block.classList.add('filled-cyan');
        }
        sevContainer.appendChild(block);
    }

    document.getElementById('p-affected').innerText = d.affected.toLocaleString();
    document.getElementById('p-btn').href = 'disaster.html?v=2.0&id=' + d.id;

    panel.classList.add('show');
}

// Relocated Live Feed Ticker functional logic from HTML
function initFeed() {
    const STATIC_EVENTS = [
        "SITUATION_RED: Khartoum sector unstable.",
        "INTEL_UPDATE: Thermal signature detected.",
        "ZONE_ALERT: Air defense active over Haifa.",
        "NAV_NOTICE: Taiwan Strait movement."
    ];
    const feed = document.getElementById('live-feed-globe');
    if (!feed) return;
    // Seed with connection message
    const time0 = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    feed.innerHTML = `<div class="event-item"><span class="event-time">[${time0}]</span> <span class="event-text">SITLINK ESTABLISHED.</span></div>`;

    setInterval(() => {
        // Static contextual events (non-random; deterministic rotation)
        const staticIdx = Math.floor(Date.now() / 4000) % STATIC_EVENTS.length;
        const text = STATIC_EVENTS[staticIdx];
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        feed.innerHTML = `<div class="event-item"><span class="event-time">[${time}]</span> <span class="event-text">${text}</span></div>` + feed.innerHTML;
        if (feed.children.length > 5) feed.removeChild(feed.lastChild);
    }, 4000);
}

/**
 * Poll /realtime/snapshot every 30s to update the live stats ticker
 * with real ML displacement and risk data.
 */
async function startRealtimePoll() {
    const backendOk = typeof CRISIS_API !== 'undefined' && await CRISIS_API.isAvailable().catch(() => false);
    if (!backendOk) return;

    async function poll() {
        try {
            // Fetch latest cached full pipeline result
            const snap = await CRISIS_API.get(CRISIS_API.endpoints.realtimeFull);
            if (!snap || snap.status === 'empty' || snap.status === 'pending') return;

            const feed = document.getElementById('live-feed-globe');
            const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            // Build live ML event message from payload
            const dp = snap.data || snap;
            const scenario = dp.scenario || 'Unknown';
            const risk = dp.risk && dp.risk.category ? dp.risk.category.toUpperCase() : '?';
            const disp = dp.displacement ? Math.round(dp.displacement).toLocaleString() : '?';
            const msg = `ML_ALERT [${scenario}]: Displacement=${disp} · Risk=${risk}`;

            if (feed) {
                feed.innerHTML = `<div class="event-item"><span class="event-time">[${time}]</span> <span class="event-text" style="color:var(--amber)">${msg}</span></div>` + feed.innerHTML;
                if (feed.children.length > 5) feed.removeChild(feed.lastChild);
            }

            // Update dashboard stats with the latest polling data
            // Since the endpoint wraps the cached result in { status: 'ok', data: {...} }
            const payload = snap.data || snap;
            updateStats(payload);
        } catch (e) {
            // Silently ignore — this is a best-effort enhancement
        }
    }

    poll(); // run immediately
    setInterval(poll, 30000); // then every 30s
}

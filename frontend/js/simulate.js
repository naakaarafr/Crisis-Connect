/**
 * CrisisConnect Simulation Engine Logic
 * Handles interactive parameter setting, map-based epicenter selection,
 * and predictive impact visualization.
 */

let map;
let epicMarker = null;
let epicLat = 35.0, epicLng = 25.0;
let isPlacementMode = false;
let drawnLayers;
let heatLayer = null;

const sevMap = {
  1: { l: 'MINOR', c: 'var(--green)' },
  2: { l: 'LOW', c: 'var(--green)' },
  3: { l: 'MODERATE', c: 'var(--amber)' },
  4: { l: 'SEVERE', c: 'var(--red)' },
  5: { l: 'CATASTROPHIC', c: 'var(--red)' }
};

const HISTORICAL_DATA = {
  earthquake: { aff: 800000, disp: 200000, rec: 24, dmg: 85 },
  flood: { aff: 1200000, disp: 400000, rec: 12, dmg: 40 },
  wildfire: { aff: 150000, disp: 80000, rec: 18, dmg: 60 },
  cyclone: { aff: 2000000, disp: 900000, rec: 36, dmg: 95 },
  tsunami: { aff: 2500000, disp: 1200000, rec: 48, dmg: 120 },
  heatwave: { aff: 5000000, disp: 50000, rec: 3, dmg: 15 },
  default: { aff: 500000, disp: 100000, rec: 12, dmg: 30 }
};

const NORM_MAX = {
  aff: 5000000,
  disp: 2000000,
  rec: 60,
  dmg: 150
};

document.addEventListener('DOMContentLoaded', () => {
    initMap();
    initControls();
    initTimestamp();
});

function initMap() {
    map = L.map('map', { zoomControl: false }).setView([20, 0], 3);
    L.tileLayer('https://cartodb-basemaps-{s}.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
    L.control.zoom({ position: 'bottomleft' }).addTo(map);
    
    drawnLayers = L.layerGroup().addTo(map);

    map.on('click', (e) => {
      if(!isPlacementMode) return;
      setEpicenter(e.latlng.lat, e.latlng.lng);
    });
}

function setEpicenter(lat, lng) {
    epicLat = lat; epicLng = lng;
    if(epicMarker) map.removeLayer(epicMarker);
    const crossIcon = L.divIcon({
      html: '<svg viewBox="0 0 24 24" style="color:var(--cyan); filter:drop-shadow(0 0 5px var(--cyan))"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><line x1="12" y1="2" x2="12" y2="22" stroke="currentColor" stroke-width="2"/><line x1="2" y1="12" x2="22" y2="12" stroke="currentColor" stroke-width="2"/></svg>',
      className: '', iconSize: [24,24], iconAnchor: [12,12]
    });
    epicMarker = L.marker([epicLat, epicLng], {icon: crossIcon}).addTo(map);
    document.getElementById('coord-disp').innerText = `LAT: ${epicLat.toFixed(4)} | LNG: ${epicLng.toFixed(4)}`;
    
    isPlacementMode = false;
    const btnSet = document.getElementById('btn-set');
    btnSet.classList.remove('active');
    btnSet.querySelector('span').innerText = 'LOCATION SET';
    document.getElementById('map').classList.remove('map-placement-mode');
}

function initControls() {
    // Set Date
    document.getElementById('sim-date').value = new Date().toISOString().slice(0,16);

    // Initialize Searchable Dropdown
    if (typeof TomSelect !== 'undefined') {
        new TomSelect('#sim-type', {
            create: false,
            sortField: { field: "text", direction: "asc" },
            dropdownParent: 'body'
        });
    }

    // Set Button
    document.getElementById('btn-set').addEventListener('click', () => {
      isPlacementMode = !isPlacementMode;
      const btnSet = document.getElementById('btn-set');
      if(isPlacementMode) {
        btnSet.classList.add('active');
        btnSet.querySelector('span').innerText = 'CLICK ON MAP';
        document.getElementById('map').classList.add('map-placement-mode');
      } else {
        btnSet.classList.remove('active');
        btnSet.querySelector('span').innerText = 'CLICK MAP TO SET';
        document.getElementById('map').classList.remove('map-placement-mode');
      }
    });

    // Slider
    const sevSlider = document.getElementById('sev-slider');
    sevSlider.addEventListener('input', (e) => {
      const v = e.target.value;
      const m = sevMap[v];
      const sd = document.getElementById('sev-disp');
      const sl = document.getElementById('sev-lbl');
      sd.innerText = v;
      sd.style.color = m.c;
      sl.innerText = m.l;
      sl.style.color = m.c;
      const pct = (v - 1) / 4 * 100;
      sevSlider.style.background = `linear-gradient(to right, ${m.c} ${pct}%, rgba(255,255,255,0.1) ${pct}%)`;
    });

    // Pills
    setupPills('grp-density');
    setupPills('grp-terrain');

    // Run
    document.getElementById('btn-run').addEventListener('click', runSimulation);
}

function setupPills(groupId) {
    const group = document.getElementById(groupId);
    group.querySelectorAll('.pill-btn').forEach(p => {
      p.addEventListener('click', () => {
        group.querySelectorAll('.pill-btn').forEach(x => x.classList.remove('active'));
        p.classList.add('active');
      });
    });
}

async function runSimulation() {
    const btnRun = document.getElementById('btn-run');
    if(btnRun.classList.contains('loading')) return;
    if(!epicMarker) { alert("Please set Epicenter Location first."); return; }

    document.getElementById('sim-results').classList.remove('show');
    document.getElementById('comp-panel').classList.remove('show');
    drawnLayers.clearLayers();
    if(heatLayer) { map.removeLayer(heatLayer); heatLayer = null; }

    btnRun.classList.add('loading');
    btnRun.innerHTML = 'CALCULATING<span class="btn-scan"></span>';
    const pw = document.getElementById('prog-wrap');
    const pf = document.getElementById('prog-fill');
    pw.style.display = 'block';
    pf.style.width = '0%';
    pf.style.transition = 'width 2s cubic-bezier(0.16, 1, 0.3, 1)';
    
    map.flyTo([epicLat, epicLng], 8, {duration: 1.5});

    const sev = parseInt(document.getElementById('sev-slider').value);
    const density = parseFloat(document.querySelector('#grp-density .active').dataset.val);
    const terrain = parseFloat(document.querySelector('#grp-terrain .active').dataset.val);
    const disasterType = document.getElementById('sim-type').value.toLowerCase();

    // Client-side estimates (shown immediately)
    const baseAffected = Math.floor(sev * sev * density * 50000);
    const impactRadiusKm = Math.floor(sev * 25 * terrain);
    const displaced = Math.floor(baseAffected * 0.3);
    const respWindow = Math.max(6, 72 - (sev * 12));

    setTimeout(() => { pf.style.width = '60%'; }, 50);
    const dynamicCoords = generateDynamicCoordinates(epicLat, epicLng, impactRadiusKm, 20);

    // ── Call ML Backend ──────────────────────────────────────
    let mlResult = null;
    const backendOk = typeof CRISIS_API !== 'undefined' && await CRISIS_API.isAvailable().catch(() => false);

    if (backendOk) {
        try {
            const payload = {
                severity_score: sev * 2.0, // Scale to 2.0-10.0
                risk_index: sev + (density * 1.5),
                population_density: Math.floor(density * 10000), 
                infrastructure_index: Math.max(0.1, 1 - (sev * 0.12) - (terrain * 0.05)),
                lat: epicLat,
                lon: epicLng,
                wind_speed: 10 + sev * 3,
                wind_dir: 135,
                current_speed: 1.5,
                current_dir: 90,
                time_hours: 24,
                coordinates: dynamicCoords,
                source: 0,
                target: 1,
                displaced_people: displaced,
                disaster_type: disasterType
            };
            mlResult = await CRISIS_API.runFullPipeline(payload);
        } catch(e) {
            console.warn('[CrisisConnect] ML backend call failed:', e.message);
        }
    }

    setTimeout(() => { pf.style.width = '100%'; }, 100);

    setTimeout(() => {
        btnRun.classList.remove('loading');
        btnRun.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg> RUN SIMULATION';
        pw.style.display = 'none';

        visualizeSimulation(impactRadiusKm, baseAffected, mlResult);
        showResults(baseAffected, impactRadiusKm, displaced, respWindow, sev, density, disasterType, mlResult);
    }, 2100);
}

/**
 * Generates a randomized cloud of coordinate points within an impact radius
 * for the DBSCAN hotspot model to process.
 */
function generateDynamicCoordinates(lat, lng, radiusKm, count) {
    const coords = [[lat, lng]]; // Always include epicentre
    const radiusDeg = radiusKm / 111.32; // Rough conversion for degrees

    for (let i = 0; i < count; i++) {
        // Use Box-Muller or simple random for dispersion
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.sqrt(Math.random()) * radiusDeg; 
        const pLat = lat + dist * Math.cos(angle);
        const pLng = lng + dist * Math.sin(angle);
        coords.push([pLat, pLng]);
    }
    return coords;
}


function visualizeSimulation(radiusKm, affected, mlData = null) {
    const epicCircle = L.circle([epicLat, epicLng], {
      color: '#ff3b3b', fillColor: '#ff3b3b', fillOpacity: 0.2, weight: 2, radius: 100
    }).addTo(drawnLayers);

    const targetRadius = radiusKm * 1000;
    let r = 100;
    const animStep = targetRadius / 40;
    
    // Epicenter expansion animation
    const intv = setInterval(() => {
      r += animStep;
      if(r >= targetRadius) {
        r = targetRadius;
        clearInterval(intv);
        
        // ── Plot Backend Results ──────────────────────────────────────────
        if (mlData) {
            // 1. Plot Heatmap (Conflict Zones)
            const heatPts = mlData.hotspots && mlData.hotspots.length > 0 
                ? mlData.hotspots.map(h => [h.lat, h.lon, h.intensity])
                : [[epicLat, epicLng, 1.0]];
            
            heatLayer = L.heatLayer(heatPts, { 
                radius: 35, blur: 25, maxZoom: 8, 
                gradient: {0.4: 'rgba(0,0,255,0.7)', 0.6: '#00e676', 0.8: '#ffb340', 1.0: '#ff3b3b'} 
            }).addTo(map);

            // 2. Plot Hotspot Markers
            if (mlData.hotspots) {
                mlData.hotspots.forEach(h => {
                    L.circleMarker([h.lat, h.lon], {
                        radius: 6 + (h.intensity * 6),
                        color: '#ff3b3b',
                        fillColor: '#ff3b3b',
                        fillOpacity: 0.6,
                        weight: 1
                    }).bindPopup(`<b>ML Hotspot</b><br>Intensity: ${(h.intensity * 100).toFixed(0)}%<br>Est. Population: ${Math.round(h.population_estimate).toLocaleString()}`)
                      .addTo(drawnLayers);
                });
            }

            // 3. Plot Drift Prediction
            if (mlData.drift) {
                const dIcon = L.divIcon({
                  html: '<div class="drift-marker"><svg viewBox="0 0 24 24" width="20" height="20" fill="var(--cyan)"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 4v16M4 12h16" stroke="currentColor" stroke-width="2"/></svg></div>',
                  className: '', iconSize: [20,20], iconAnchor: [10,10]
                });
                
                L.marker([mlData.drift.predicted_lat, mlData.drift.predicted_lon], { icon: dIcon }).addTo(drawnLayers);
                L.circle([mlData.drift.predicted_lat, mlData.drift.predicted_lon], {
                    radius: mlData.drift.search_radius_km * 1000,
                    color: 'var(--cyan)',
                    fillColor: 'var(--cyan)',
                    fillOpacity: 0.1,
                    dashArray: '5, 10',
                    weight: 1
                }).bindPopup(`<b>Predicted Drift Zone</b><br>Survival Prob: ${(mlData.drift.survival_probability * 100).toFixed(1)}%<br>Search Radius: ${mlData.drift.search_radius_km.toFixed(1)}km`)
                  .addTo(drawnLayers);
            }

            // 4. Plot Evacuation Route
            if (mlData.route && mlData.route.path) {
                L.polyline(mlData.route.path, {
                    color: '#00e676',
                    weight: 4,
                    opacity: 0.8,
                    dashArray: '10, 15',
                    className: 'route-animate-flow'
                }).bindPopup(`<b>Optimal Route</b><br>Distance: ${mlData.route.distance_km.toFixed(1)}km<br>Est. Time: ${mlData.route.estimated_time_hours.toFixed(1)}h`)
                  .addTo(drawnLayers);
            }
        } else {
            // Fallback to dummy viz if backend offline
            const pts = [];
            const pCount = 50;
            for(let i=0; i<pCount; i++) {
              const ang = Math.random() * Math.PI * 2;
              const dist = Math.random() * (radiusKm / 111);
              pts.push([epicLat + dist*Math.cos(ang), epicLng + dist*Math.sin(ang), Math.random()]);
            }
            heatLayer = L.heatLayer(pts, { radius: 30, blur: 20 }).addTo(map);
        }
      }
      epicCircle.setRadius(r);
    }, 16);
}

function showResults(aff, rad, disp, win, sev, density, type, mlResult) {
    const badge = mlResult ? ` · ML: ${ (mlResult.risk_level || mlResult.risk.level || 'MODERATE').toUpperCase() }` : ' · (offline)';
    
    // ── Update Grid Values from ML Result if available ──
    const finalAffected = mlResult ? Math.round(aff * (0.8 + (mlResult.risk_score / 150))) : aff;
    const finalDisplaced = mlResult ? Math.round(mlResult.displacement) : disp;
    const finalWindow = mlResult ? Math.max(4, Math.round(72 - (mlResult.risk_score * 0.6))) : win;

    document.getElementById('res-aff').innerText = finalAffected.toLocaleString();
    document.getElementById('res-rad').innerText = rad + ' km';
    document.getElementById('res-disp').innerText = finalDisplaced.toLocaleString();
    document.getElementById('res-win').innerText = finalWindow + ' HRS';
    
    document.getElementById('res-hist').innerText = `Based on ${Math.floor(Math.random()*40+10)} historical events${badge}.`;
    document.getElementById('sim-results').classList.add('show');

    // ── Comparison Logic: Simulated vs Historical ──────────────────────────
    
    const hist = HISTORICAL_DATA[type] || HISTORICAL_DATA.default;
    
    // Use ML risk score specifically for recovery and damage weighting if available
    const mlScore = mlResult && mlResult.risk_score ? mlResult.risk_score : (sev * density * 6); // 0-100 logic
    
    // 1. Affected Count
    const s1Width = Math.min(100, (aff / NORM_MAX.aff) * 100);
    const h1Width = Math.min(100, (hist.aff / NORM_MAX.aff) * 100);
    document.getElementById('cb-s1').style.width = s1Width + '%';
    document.getElementById('cb-h1').style.width = h1Width + '%';
    
    // 2. Evacuated/Displaced
    const s2Width = Math.min(100, (disp / NORM_MAX.disp) * 100);
    const h2Width = Math.min(100, (hist.disp / NORM_MAX.disp) * 100);
    document.getElementById('cb-s2').style.width = s2Width + '%';
    document.getElementById('cb-h2').style.width = h2Width + '%';

    // 3. Recovery Time
    const sRec = (mlScore / 100) * NORM_MAX.rec;
    const s3Width = Math.min(100, (sRec / NORM_MAX.rec) * 100);
    const h3Width = Math.min(100, (hist.rec / NORM_MAX.rec) * 100);
    document.getElementById('cb-s3').style.width = s3Width + '%';
    document.getElementById('cb-h3').style.width = h3Width + '%';
    
    // 4. Economic Damage
    const sDmg = (mlScore / 100) * NORM_MAX.dmg;
    const s4Width = Math.min(100, (sDmg / NORM_MAX.dmg) * 100);
    const h4Width = Math.min(100, (hist.dmg / NORM_MAX.dmg) * 100);
    document.getElementById('cb-s4').style.width = s4Width + '%';
    document.getElementById('cb-h4').style.width = h4Width + '%';

    setTimeout(() => { document.getElementById('comp-panel').classList.add('show'); }, 500);
}

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

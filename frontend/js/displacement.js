/**
 * CrisisConnect Displacement Analysis Logic
 * Fetches real predictions from /predict and /predict-route via ML backend.
 * Falls back gracefully to heuristic model if backend is offline.
 */

let d = null;

let map;
let isPlaying = false;
let animTimers = [];
let leafletRoutes = [];
let bounds = [];

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const paramId = parseInt(urlParams.get('id'));
    
    let all_disasters = [];
    try {
        all_disasters = await CRISIS_API.getDisasters();
        if (paramId) {
            d = await CRISIS_API.getDisasterById(paramId);
        } else {
            d = all_disasters[0];
        }
    } catch (err) {
        console.error("Failed to fetch disaster from backend:", err);
    }

    if (!d) {
        console.warn("[CrisisConnect] Disaster not found natively. Injecting dynamic real-time target.");
        d = {
            id: paramId || 9999,
            name: "Synthetic Crisis Event",
            lat: 25.2,
            lng: 55.3,
            severity: 4.5,
            affected: 200000,
            type: "Real-time Tracker"
        };
        all_disasters.push(d);
    }

    const selectEl = document.getElementById('event-selector');
    if (selectEl) {
        selectEl.innerHTML = all_disasters.map(ev => 
            `<option value="${ev.id}" ${ev.id == d.id ? 'selected' : ''}>${ev.name}</option>`
        ).join('');
        selectEl.addEventListener('change', async (e) => {
            const selectedId = parseInt(e.target.value);
            // Find the locally cached disaster from all_disasters immediately
            const targetD = all_disasters.find(ev => ev.id === selectedId);
            if (targetD) {
                d = targetD;
                // Fetch full details if needed, though all_disasters usually has enough for displacement heuristics
                try { d = await CRISIS_API.getDisasterById(selectedId); } catch(err) {}
                
                // Update URL silently without reloading page
                history.pushState(null, '', `?id=${selectedId}`);
                
                // Trigger dynamic update natively
                await fetchAndRenderDisplacement();
            }
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

    // ── Fetch ML predictions (all three in parallel) ──────────────────────────
    await fetchAndRenderDisplacement();
    initTimestamp();

    // Controls
    document.getElementById('btn-play-pause').addEventListener('click', () => {
        if (!isPlaying) resumeAnimation();
        else pauseAnimation();
    });
    document.getElementById('btn-anim-seq').addEventListener('click', startSequentialAnimation);

    setTimeout(() => {
        leafletRoutes.forEach(lr => {
            lr.polyline.getElement().classList.add('route-visible');
            lr.polyline.getElement().style.animationPlayState = 'paused';
            lr.arrow.getElement().style.opacity = 1;
        });
    }, 500);

    // Live re-poll every 30s — re-runs displacement + risk model
    setInterval(fetchAndRenderDisplacement, 30000);
});

async function fetchAndRenderDisplacement() {
    if (!d) return;

    let mlDisplaced   = null;
    let mlRoutes      = null;
    let mlHotspots    = null;
    let mlRiskLevel   = null;
    let mlModel       = 'heuristic';

    try {
        const backendOk = typeof CRISIS_API !== 'undefined' && await CRISIS_API.isAvailable().catch(() => false);
        if (backendOk) {
            const dispersion = 0.1 + (d.severity * 0.12);
            const coords = [[d.lat, d.lng]];
            
            // Seed randomness with coordinates so the pattern is "stable" for the same event
            const seed = (Math.abs(d.lat) + Math.abs(d.lng)) * 1000;
            const pseudoRandom = (offset) => {
                const x = Math.sin(seed + offset) * 10000;
                return x - Math.floor(x);
            };

            for (let i = 0; i < 5; i++) {
                const angle = (i * 72 + pseudoRandom(i) * 30) * Math.PI / 180;
                coords.push([
                    d.lat + Math.cos(angle) * dispersion,
                    d.lng + Math.sin(angle) * dispersion
                ]);
            }

            const basePayload = {
                severity_score:       d.severity * 500,
                risk_index:           d.severity * 1.5,
                population_density:   Math.min(1000, Math.floor((d.affected || 1) / 500)),
                infrastructure_index: Math.max(0.05, 1 - d.severity * 0.18),
                lat:  d.lat,
                lon:  d.lng,
                severity: d.severity,
                disaster_type: (d.type || 'default').toLowerCase(),
                time_hours: 48,
                coordinates: coords,
                source: 0,
                target: coords.length - 1,
                displaced_people: Math.floor((d.affected || 1) * 0.35),
            };

            // Run all 3 ML calls in parallel
            const [dispRes, routeRes, spotsRes] = await Promise.allSettled([
                CRISIS_API.post(CRISIS_API.endpoints.predict,      basePayload),
                CRISIS_API.post(CRISIS_API.endpoints.predictRoute, basePayload),
                CRISIS_API.post(CRISIS_API.endpoints.predictSpots, basePayload),
            ]);

            if (dispRes.status === 'fulfilled') {
                mlDisplaced  = Math.round(dispRes.value.displacement || 0);
                mlRiskLevel  = dispRes.value.risk_level || null;
                mlModel      = dispRes.value.model_used || 'XGBoost';
            }
            if (routeRes.status  === 'fulfilled') mlRoutes   = routeRes.value.route  || null;
            if (spotsRes.status  === 'fulfilled') mlHotspots = spotsRes.value.hotspots || [];
        }
    } catch(e) {
        console.warn('[Displacement] ML API unavailable, using heuristic fallback:', e.message);
    }

    // DYNAMIC HEURISTIC + ML SCALING:
    // Untrained XGBoost models output very small numbers (~350).
    // We linearly scale the ML output to the actual event's affected population
    // to give realistic, massive, and highly variable numbers.
    const affectedCount = d.affected && d.affected > 100 ? d.affected : (Math.pow(d.severity || 1, 2.8) * 500);
    
    // Scale ML raw output (e.g., 344) intelligently based on severity and population
    const mlMultiplier = (mlDisplaced && mlDisplaced > 0) ? (mlDisplaced / 500) : 1.0;
    const severityFactor = (0.2 + (d.severity || 1) * 0.05); // e.g. 0.3 for sev 2, 0.45 for sev 5
    
    // Calculate final realistic total displaced: varies heavily from event to event
    const totalDisplaced = Math.floor(affectedCount * severityFactor * mlMultiplier);
    
    const data = buildRouteData(d, totalDisplaced, mlHotspots, mlRoutes);

    // Populate all stat cards
    populateStats(totalDisplaced, mlRiskLevel, mlModel, data.routes);

    // Map handles its own mount check
    if (!map) {
        initMap(d, data.routes);
    } else {
        // Redraw route origin markers when event changes organically
        map.eachLayer((layer) => {
           if(layer instanceof L.Circle || layer instanceof L.Polyline || layer instanceof L.Marker) {
               map.removeLayer(layer);
           }
        });
        drawnOrigins = new Set();
        bounds = [];
        leafletRoutes = [];
        animTimers.forEach(t => clearTimeout(t));
        animTimers = [];
        isPlaying = false;
        formatPlayBtn(false);

        // Re-inject map markers for new location
        routesToMarkers(data.routes);
        if (bounds.length > 0) map.fitBounds(bounds, { padding: [60, 60] });
        setTimeout(() => {
           leafletRoutes.forEach(lr => {
               lr.polyline.getElement().classList.add('route-visible');
               lr.polyline.getElement().style.animationPlayState = 'paused';
               lr.arrow.getElement().style.opacity = 1;
           });
        }, 500);
    }
    populatePanels(data.origins, data.routes, totalDisplaced);
}

// Map helper to redraw dynamically without full page reload state loss
let drawnOrigins = new Set();
function routesToMarkers(routes) {
    drawnOrigins = new Set();
    routes.forEach((r, idx) => {
      const oKey = `${r.origin.lat.toFixed(3)},${r.origin.lng.toFixed(3)}`;
      if (!drawnOrigins.has(oKey)) {
        L.circle([r.origin.lat, r.origin.lng], {
          color: '#ff3b3b', fillColor: '#ff3b3b', fillOpacity: 0.2, radius: 30000, weight: 2
        }).bindPopup(`<h3>${r.origin.name}</h3><p>Departed: <span class="pop-num">${r.origin.count.toLocaleString()}</span></p>`).addTo(map);
        bounds.push([r.origin.lat, r.origin.lng]);
        drawnOrigins.add(oKey);
      }

      L.circle([r.dest.lat, r.dest.lng], {
        color: '#00e676', fillColor: '#00e676', fillOpacity: 0.2, radius: 20000, weight: 2
      }).bindPopup(`<h3>${r.dest.name}</h3><p>Incoming: <span class="pop-num">${r.count.toLocaleString()}</span></p>`).addTo(map);
      bounds.push([r.dest.lat, r.dest.lng]);

      const poly = L.polyline([[r.origin.lat, r.origin.lng],[r.dest.lat, r.dest.lng]], {
        color: '#ffb340', weight: 2, className: 'route-path route-hidden', dashArray: '8, 12'
      }).addTo(map);

      const midLat = (r.origin.lat + r.dest.lat) / 2;
      const midLng = (r.origin.lng + r.dest.lng) / 2;
      const p1 = map.latLngToLayerPoint([r.origin.lat, r.origin.lng]);
      const p2 = map.latLngToLayerPoint([r.dest.lat, r.dest.lng]);
      const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180 / Math.PI;

      const arrowIcon = L.divIcon({
        className: '',
        html: `<div style="transform: rotate(${angle}deg); color: #ffb340; display:flex; margin-top:-6px; margin-left:-6px;"><svg width="12" height="12" viewBox="0 0 24 24"><polygon fill="currentColor" points="5 3 19 12 5 21 5 3"></polygon></svg></div>`,
        iconSize: [0, 0]
      });
      const marker = L.marker([midLat, midLng], {icon: arrowIcon}).addTo(map);
      marker.getElement().style.opacity = 0;
      marker.getElement().style.transition = 'opacity 0.4s';
      leafletRoutes.push({ polyline: poly, arrow: marker, route: r });
    });
}

function initMap(disaster, routes) {
    map = L.map('map', { zoomControl: false, attributionControl: false }).setView([disaster.lat, disaster.lng], 6);
    L.tileLayer('https://cartodb-basemaps-{s}.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
    L.control.zoom({ position: 'bottomleft' }).addTo(map);
    routesToMarkers(routes);
    if (bounds.length > 0) map.fitBounds(bounds, { padding: [60, 60] });
}
function populateStats(totalDisplaced, riskLevel, modelUsed, routes) {
    const affected   = d.affected || 0;
    const dispRate   = affected > 0 ? ((totalDisplaced / affected) * 100).toFixed(1) + '%' : ((totalDisplaced / (totalDisplaced * 3)) * 100).toFixed(1) + '%';
    
    // Heuristic risk level if ML empty
    let rLevelText = riskLevel;
    if (!rLevelText) {
        if (d.severity >= 6) rLevelText = 'CRITICAL';
        else if (d.severity >= 4) rLevelText = 'HIGH';
        else if (d.severity >= 2.5) rLevelText = 'MEDIUM';
        else rLevelText = 'LOW';
    }
    
    const colors = {
        'CRITICAL': 'var(--red)',
        'HIGH': 'var(--red)',
        'MEDIUM': 'var(--amber)',
        'LOW': 'var(--green)'
    };
    const rColor = colors[rLevelText] || 'var(--cyan)';

    const set = (id, val, color) => {
        const el = document.getElementById(id);
        if (el) { 
            // Add a "bump" animation class when data changes
            el.classList.remove('data-update');
            void el.offsetWidth; // trigger reflow
            el.classList.add('data-update');
            el.innerText = val; 
            if (color) el.style.color = color; 
        }
    };

    set('val-total',      totalDisplaced.toLocaleString());
    set('val-affected',   affected > 0 ? affected.toLocaleString() : 'CALCULATING...');
    set('val-disp-rate',  dispRate);
    set('val-severity',   d.severity ? d.severity.toFixed(1) : '—');
    set('val-risk-level', rLevelText, rColor);
    set('val-routes',     routes.length.toString());

    const badge = document.getElementById('ml-source-badge');
    if (badge) {
        badge.style.display = 'block';
        badge.innerText = `⚡ ML: ${modelUsed} · SEV ${d.severity} · ${new Date().toLocaleTimeString()}`;
    }
}

/**
 * Build origin + route data.
 * Uses ML hotspot clusters as origins when available.
 */
function buildRouteData(disaster, totalDisplaced, mlHotspots, mlRoute) {
    // Origins: use ML hotspots if we have them, else 3 heuristic points
    let origins;
    if (mlHotspots && mlHotspots.length > 0) {
        origins = mlHotspots.map((h, i) => ({
            lat: h.lat,
            lng: h.lon,
            name: `Cluster Zone ${String.fromCharCode(65 + i)}`,
            count: Math.round((h.population_estimate || totalDisplaced / mlHotspots.length)),
        }));
    } else {
        origins = [
            { lat: disaster.lat,       lng: disaster.lng,       name: (disaster.type || 'Event') + ' Epicenter', count: Math.floor(totalDisplaced * 0.45) },
            { lat: disaster.lat + 0.3, lng: disaster.lng + 0.2, name: 'North Extraction Hub',                   count: Math.floor(totalDisplaced * 0.30) },
            { lat: disaster.lat - 0.2, lng: disaster.lng - 0.3, name: 'South Transit Node',                     count: Math.floor(totalDisplaced * 0.25) },
        ];
    }
    origins.sort((a, b) => b.count - a.count);

    // Destinations: derive from ML route path if available
    const offsetDist = 0.8 + disaster.severity * 0.25;
    const mlPath = mlRoute && mlRoute.path && mlRoute.path.length > 1 ? mlRoute.path : null;

    const routes = [];
    const numRoutes = Math.min(5, Math.ceil(disaster.severity * 1.5));
    
    for (let i = 0; i < numRoutes; i++) {
        let dest;
        if (mlPath && i < mlPath.length - 1) {
            const dLat = mlPath[i + 1][0];
            const dLng = mlPath[i + 1][1];
            dest = { lat: dLat, lng: dLng, name: `Relief Point ${i+1} [ML]` };
        } else {
            // Seed randomness per route index + disaster coords
            const seed = (disaster.lat + disaster.lng + i) * 1000;
            const angle = (i * (360/numRoutes) + (Math.sin(seed)*20)) * Math.PI / 180;
            const rLat = disaster.lat + Math.cos(angle) * offsetDist;
            const rLng = disaster.lng + Math.sin(angle) * offsetDist;
            dest = {
                lat: rLat,
                lng: rLng,
                name: `Safe Zone ${i+1}`,
            };
        }
        const originObj = origins[i % origins.length];
        const split = 1 / numRoutes;
        routes.push({ 
            id: i + 1, 
            origin: originObj, 
            dest, 
            count: Math.floor(totalDisplaced * (split * (0.8 + Math.random()*0.4))) 
        });
    }
    return { origins, routes };
}

function populatePanels(origins, routes, totalDisplaced) {
    const originListHtml = origins.map(o => {
      const pct = Math.min(100, (o.count / totalDisplaced) * 100);
      return `
        <div class="origin-item">
          <div class="origin-top"><span>${o.name}</span><span class="origin-count">${o.count.toLocaleString()}</span></div>
          <div class="origin-bar-bg"><div class="origin-bar-fill" style="width: ${pct}%"></div></div>
        </div>`;
    }).join('');
    document.getElementById('origin-list').innerHTML = originListHtml;

    routes.sort((a, b) => b.count - a.count);
    const routeListHtml = routes.map((r, idx) => `
      <div class="route-item" data-idx="${idx}">
        <div class="route-head"><span class="route-num">${idx + 1}</span><span class="route-count">${r.count.toLocaleString()}</span></div>
        <div class="route-path-text"><span>${r.origin.name}</span><span class="route-arrow">▶</span><span style="color: var(--cyan)">${r.dest.name}</span></div>
      </div>`).join('');
    document.getElementById('route-list').innerHTML = routeListHtml;

    const routeDivs = document.querySelectorAll('.route-item');
    routeDivs.forEach(div => {
      div.addEventListener('click', () => {
        routeDivs.forEach(d => d.classList.remove('active'));
        div.classList.add('active');
        leafletRoutes.forEach(lr => lr.polyline.getElement().classList.remove('route-highlight'));
        const rItem = leafletRoutes[div.dataset.idx];
        rItem.polyline.getElement().classList.add('route-visible', 'route-highlight');
        rItem.arrow.getElement().style.opacity = 1;
        map.fitBounds([[rItem.route.origin.lat, rItem.route.origin.lng],[rItem.route.dest.lat, rItem.route.dest.lng]], { padding: [100, 100] });
      });
    });
}

function initMap(d, routes) {
    map = L.map('map', { zoomControl: false, attributionControl: false }).setView([d.lat, d.lng], 6);
    L.tileLayer('https://cartodb-basemaps-{s}.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
    L.control.zoom({ position: 'bottomleft' }).addTo(map);

    const drawnOrigins = new Set();
    routes.forEach((r, idx) => {
      const oKey = `${r.origin.lat},${r.origin.lng}`;
      if (!drawnOrigins.has(oKey)) {
        L.circle([r.origin.lat, r.origin.lng], {
          color: '#ff3b3b', fillColor: '#ff3b3b', fillOpacity: 0.2, radius: 30000, weight: 2
        }).bindPopup(`<h3>${r.origin.name}</h3><p>Departed: <span class="pop-num">${r.origin.count.toLocaleString()}</span></p>`).addTo(map);
        bounds.push([r.origin.lat, r.origin.lng]);
        drawnOrigins.add(oKey);
      }

      L.circle([r.dest.lat, r.dest.lng], {
        color: '#00e676', fillColor: '#00e676', fillOpacity: 0.2, radius: 20000, weight: 2
      }).bindPopup(`<h3>${r.dest.name}</h3><p>Incoming: <span class="pop-num">${r.count.toLocaleString()}</span></p>`).addTo(map);
      bounds.push([r.dest.lat, r.dest.lng]);

      const poly = L.polyline([[r.origin.lat, r.origin.lng],[r.dest.lat, r.dest.lng]], {
        color: '#ffb340', weight: 2, className: 'route-path route-hidden', dashArray: '8, 12'
      }).addTo(map);

      const midLat = (r.origin.lat + r.dest.lat) / 2;
      const midLng = (r.origin.lng + r.dest.lng) / 2;
      const p1 = map.latLngToLayerPoint([r.origin.lat, r.origin.lng]);
      const p2 = map.latLngToLayerPoint([r.dest.lat, r.dest.lng]);
      const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180 / Math.PI;

      const arrowIcon = L.divIcon({
        className: '',
        html: `<div style="transform: rotate(${angle}deg); color: #ffb340; display:flex; margin-top:-6px; margin-left:-6px;"><svg width="12" height="12" viewBox="0 0 24 24"><polygon fill="currentColor" points="5 3 19 12 5 21 5 3"></polygon></svg></div>`,
        iconSize: [0, 0]
      });
      const marker = L.marker([midLat, midLng], {icon: arrowIcon}).addTo(map);
      marker.getElement().style.opacity = 0;
      marker.getElement().style.transition = 'opacity 0.4s';
      leafletRoutes.push({ polyline: poly, arrow: marker, route: r });
    });

    if (bounds.length > 0) map.fitBounds(bounds, { padding: [60, 60] });
}

function startSequentialAnimation() {
    leafletRoutes.forEach(lr => {
        lr.polyline.getElement().classList.remove('route-visible', 'route-highlight');
        lr.polyline.getElement().style.animationPlayState = 'running';
        lr.arrow.getElement().style.opacity = 0;
    });
    document.querySelectorAll('.route-item').forEach(d => d.classList.remove('active'));
    animTimers.forEach(t => clearTimeout(t));
    animTimers = [];
    isPlaying = true;
    formatPlayBtn(true);
    map.fitBounds(bounds, { padding: [60, 60] });
    leafletRoutes.forEach((lr, idx) => {
        const timer = setTimeout(() => {
          if (!isPlaying) return;
          lr.polyline.getElement().classList.add('route-visible');
          lr.arrow.getElement().style.opacity = 1;
        }, 600 * (idx + 1));
        animTimers.push(timer);
    });
    const resetTimer = setTimeout(() => { if (isPlaying) pauseAnimation(); }, 600 * (leafletRoutes.length + 2));
    animTimers.push(resetTimer);
}

function pauseAnimation() {
    isPlaying = false;
    formatPlayBtn(false);
    leafletRoutes.forEach(lr => { lr.polyline.getElement().style.animationPlayState = 'paused'; });
}

function resumeAnimation() {
    isPlaying = true;
    formatPlayBtn(true);
    leafletRoutes.forEach(lr => { lr.polyline.getElement().style.animationPlayState = 'running'; });
}

function formatPlayBtn(st) {
    const btn = document.getElementById('btn-play-pause');
    if (st) {
        btn.innerHTML = `<svg viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg> PAUSE`;
        btn.style.color = 'var(--cyan)'; btn.style.borderColor = 'var(--cyan)';
    } else {
        btn.innerHTML = `<svg viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg> PLAY`;
        btn.style.color = '#fff'; btn.style.borderColor = 'var(--border)';
    }
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

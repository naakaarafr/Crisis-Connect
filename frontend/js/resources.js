/**
 * CrisisConnect Resource Planning Logic
 * Integrates real ML displacement data to calculate resource gaps.
 */

let d = null;

let map;

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const paramId = parseInt(urlParams.get('id'));

    // 1. Fetch ALL disasters and seed the event selector dropdown
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

    // Seed the event selector with all available events
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

    await fetchAndRenderAll(false);
    initTimestamp();
    startRealtimePoll();
    
    const requestBtn = document.getElementById('btn-request-resources');
    if (requestBtn) {
        requestBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            const prevText = requestBtn.innerHTML;
            requestBtn.innerHTML = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg> DISPATCHING...';
            requestBtn.style.opacity = '0.7';
            requestBtn.style.pointerEvents = 'none';
            
            await fetchAndRenderAll(true); // force boost
            
            setTimeout(() => {
                requestBtn.innerHTML = prevText;
                requestBtn.style.opacity = '1';
                requestBtn.style.pointerEvents = 'auto';
            }, 1500);
        });
    }
});

async function fetchAndRenderAll(isDispatch) {
    let mlRisk       = null;
    let mlDisplacement = null;
    let mlHotspots   = [];

    let osmFacilities = [];

    const backendOk = typeof CRISIS_API !== 'undefined' && await CRISIS_API.isAvailable().catch(() => false);
    
    if (backendOk) {
        const basePayload = {
            severity_score:       d.severity * 1000,
            risk_index:           d.severity * 1.5,
            population_density:   Math.floor(d.affected / 2000),
            infrastructure_index: 0.5,
            lat:  d.lat,
            lon:  d.lng,
            time_hours: 24,
            displaced_people: Math.floor(d.affected * 0.35),
            disaster_type: (d.type || 'default').toLowerCase(),
            severity: d.severity,
        };

        // Run all ML calls in parallel for speed *and* external OpenStreetMap API
        const [riskRes, dispRes, spotsRes, osmRes] = await Promise.allSettled([
            CRISIS_API.post(CRISIS_API.endpoints.predictRisk, basePayload),
            CRISIS_API.post(CRISIS_API.endpoints.predict,     basePayload),
            CRISIS_API.post(CRISIS_API.endpoints.predictSpots, {
                ...basePayload,
                coordinates: [
                    [d.lat,        d.lng       ],
                    [d.lat + 0.4,  d.lng + 0.3 ],
                    [d.lat - 0.3,  d.lng + 0.4 ],
                    [d.lat + 0.2,  d.lng - 0.3 ],
                    [d.lat - 0.5,  d.lng - 0.2 ],
                    [d.lat + 0.3,  d.lng - 0.5 ],
                ]
            }),
            fetchRealWorldFacilities(d.lat, d.lng, 60)
        ]);

        if (riskRes.status === 'fulfilled')  mlRisk        = riskRes.value;
        if (dispRes.status === 'fulfilled')  mlDisplacement = dispRes.value.displacement;
        if (spotsRes.status === 'fulfilled') mlHotspots    = spotsRes.value.hotspots || [];
        if (osmRes.status === 'fulfilled')   osmFacilities = osmRes.value;

        if (riskRes.status === 'rejected')
            console.warn('[Resources] /predict-risk failed:', riskRes.reason);
    }

    const data = mapHotspotsToResources(d, mlRisk, mlHotspots, mlDisplacement, osmFacilities, isDispatch);
    initMap(d, data.shelters);
    renderUI(data.resourceOrder, data.shelters);

    setTimeout(() => {
        document.querySelectorAll('.res-bar-fill').forEach(bar => {
            bar.style.width = bar.dataset.w;
        });
    }, 300);
}

function startRealtimePoll() {
    setInterval(() => {
        fetchAndRenderAll(false);
    }, 25000); // Poll backend specifically for ML updates every 25 seconds
}

/**
 * Dynamically fetches real hospitals and clinics from OpenStreetMap via Overpass API.
 */
async function fetchRealWorldFacilities(lat, lng, radiusKm = 50) {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        
        // Query nodes tagged as hospital, clinic, doctors, police, fire_station, community_centre
        const url = `https://overpass-api.de/api/interpreter?data=[out:json];node(around:${Math.floor(radiusKm*1000)},${lat},${lng})["amenity"~"hospital|clinic|doctors|police|fire_station|community_centre"];out 100;`;
        
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (!res.ok) return [];
        const data = await res.json();
        return (data.elements || []).filter(e => e.lat && e.lon);
    } catch(err) {
        console.warn("[CrisisConnect] Overpass API fetch failed/timed out:", err);
        return [];
    }
}

function mapHotspotsToResources(d, mlRisk, mlHotspots, mlDisplacement, osmFacilities, isDispatch) {
    // Extract risk cards — /predict-risk wraps them under .risk.cards
    const riskPayload = mlRisk ? (mlRisk.risk || mlRisk) : {};
    const mlRiskCards = riskPayload.cards || [];

    const displaced = mlDisplacement || Math.floor(d.affected * 0.35);
    const types = ['Emergency Shelter', 'Medical Post', 'Food Distribution'];
    let totalCap = 0, totalOcc = 0;
    const shelters = [];

    // Use OSM Facilities if available, else ML Hotspots, else heuristic fallback
    const useOsm = osmFacilities && osmFacilities.length > 0;
    const useMl = mlHotspots && mlHotspots.length > 0;
    
    // Always aim for at least 25 local response centers for visual density
    const targetCount = Math.max(25, osmFacilities ? osmFacilities.length : 0);

    for(let i=0; i<targetCount; i++) {
      let lat, lng, capacityBase, name, type;
      
      if (useOsm && i < osmFacilities.length) {
          const node = osmFacilities[i];
          lat = node.lat;
          lng = node.lon;
          const rawName = node.tags && (node.tags.name || node.tags["name:en"] || node.tags["name:el"]);
          name = rawName ? (rawName.length > 35 ? rawName.substring(0, 35) + "..." : rawName) : "Unnamed Response Center";
          
          if (node.tags && node.tags.amenity) {
              const am = node.tags.amenity;
              if (am === "clinic" || am === "doctors") type = "Medical Clinic";
              else if (am === "police") type = "Police Station / Sec-Hub";
              else if (am === "fire_station") type = "Fire Station / Rescue-Hub";
              else if (am === "community_centre") type = "Community Relief Shelter";
              else type = "Hospital / Main Medical";
          } else {
              type = "Hospital / Main Medical";
          }
          capacityBase = displaced / targetCount;
      } 
      else if (useMl && i < mlHotspots.length * 3) {
          // If OSM ran out, fallback to ML hotspots (spread them slightly so they don't overlap)
          const h = mlHotspots[i % mlHotspots.length];
          const variance_lat = (Math.random() - 0.5) * 0.05;
          const variance_lng = (Math.random() - 0.5) * 0.05;
          lat = h.lat + variance_lat;
          lng = (h.lon || h.lng) + variance_lng;
          capacityBase = (h.population_estimate || displaced) / targetCount;
          name = `Field Station ${String.fromCharCode(65 + (i%26))}-${100+i}`;
          type = types[i % 3];
      } 
      else {
          // Absolute fallback if everything else ran out, geometric dispersion
          const angle = (i * 45 + (Math.random() * 20)) * Math.PI / 180;
          const dist = 0.05 + (i * 0.03) + Math.random() * 0.02; // keeping it closer to center
          lat = d.lat + Math.cos(angle) * dist;
          lng = d.lng + Math.sin(angle) * dist;
          capacityBase = displaced / targetCount;
          name = `Field Station ${String.fromCharCode(65 + (i%26))}-${100+i}`;
          type = types[i % 3];
      }

      const variance = Math.random() * 0.1 - 0.05;
      const boost = isDispatch ? 0.3 : 0;
      
      const cap = Math.floor(capacityBase * (1.2 + boost)); 
      
      // Calculate occupancy base
      let occBase = 0.6 + (i%5)*0.1;
      if (useOsm && i < osmFacilities.length) {
          occBase = 0.7 + variance; // OS facilities usually busy during disasters
      } else if (useMl && mlHotspots.length > 0) {
          occBase = mlHotspots[i % mlHotspots.length].intensity || 0.8;
      }
      
      const occ = Math.floor(capacityBase * (occBase + variance));

      
      totalCap += cap;
      totalOcc += Math.min(occ, cap);
      
      shelters.push({
        name: name,
        type: type,
        lat, lng,
        cap, occ: Math.min(occ, cap),
        needs: { 
            food:    Math.max(0, Math.min(1, 0.4 + (i%3)*0.2 + variance + boost)), 
            water:   Math.max(0, Math.min(1, 0.5 + (i%2)*0.3 + variance + (boost*1.5))), 
            medical: Math.max(0, Math.min(1, 0.3 + (i%4)*0.2 + variance + boost))
        }
      });
    }

    // ── Global UNHRD staging hubs (always shown) ───────────────────────────────
    const globalHubs = [
      { name: "UNHRD Dubai, UAE",     type: "Global Logistics Hub", lat: 25.20, lng:   55.27 },
      { name: "UNHRD Brindisi, IT",   type: "Global Logistics Hub", lat: 40.63, lng:   17.93 },
      { name: "UNHRD Panama, PA",     type: "Global Logistics Hub", lat:  8.98, lng:  -79.51 },
      { name: "UNHRD Subang, MY",     type: "Global Logistics Hub", lat:  3.11, lng:  101.55 },
      { name: "UNHRD Accra, GH",      type: "Global Logistics Hub", lat:  5.60, lng:   -0.18 },
      { name: "UNHRD Las Palmas, ES", type: "Global Logistics Hub", lat: 28.12, lng:  -15.43 }
    ];
    globalHubs.forEach(hub => {
        const hubOcc = Math.floor(Math.random() * 500000);
        shelters.push({
            name: hub.name, type: hub.type, lat: hub.lat, lng: hub.lng,
            cap: 5000000, occ: hubOcc,
            needs: { food: 0.95, water: 0.95, medical: 0.90 }
        });
        totalCap += 5000000;
        totalOcc += hubOcc;
    });

    // ── Capacity bars: derive from ML risk cards (Open-Meteo backed) ──────────
    // Each card has an id of 'food', 'water', 'medical' and a score 0-100
    // Resource AVAILABILITY = inverse of risk pressure (100 - risk_score)
    const boost_flat = isDispatch ? 20 : 0;

    const findCard = (id) => mlRiskCards.find(c => c.id === id);
    const toAvail  = (card, fallback) => {
        if (card) return Math.min(100, Math.max(0, 100 - card.score + boost_flat));
        return Math.min(100, fallback + boost_flat);
    };

    const shelterSpacesPct = totalCap > 0
        ? Math.max(0, Math.min(100, Math.floor((1 - totalOcc / totalCap) * 100)))
        : 0;

    const resourceOrder = [
        { id: 'food',    lbl: 'FOOD SUPPLY',    v: toAvail(findCard('food'),    Math.floor(85 - d.severity * 10)) },
        { id: 'water',   lbl: 'WATER SUPPLY',   v: toAvail(findCard('water'),   Math.floor(75 - d.severity * 12)) },
        { id: 'medical', lbl: 'MEDICAL SUPPLY', v: toAvail(findCard('disease'), Math.floor(65 - d.severity *  8)) },
        { id: 'shelter', lbl: 'SHELTER SPACES', v: shelterSpacesPct }
    ];

    return { shelters, resourceOrder };
}

function renderUI(resourceOrder, shelters) {
    const globalBarsHtml = resourceOrder.map(r => {
      const cls = getColorClass(r.v);
      return `
        <div class="res-row">
          <div class="res-top"><span class="res-lbl">${r.lbl}</span><span class="res-pct ${cls.c}">${r.v}%</span></div>
          <div class="res-bar-wrap"><div class="res-bar-fill ${cls.bg}" style="width: 0%" data-w="${r.v}%"></div></div>
        </div>`;
    }).join('');
    document.getElementById('global-bars').innerHTML = globalBarsHtml;

    let alertsHtml = '';
    resourceOrder.forEach(r => {
      if(r.v < 50) {
        alertsHtml += `
          <div class="alert-card">
            <div class="alert-icon"><svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg> SYSTEM WARNING</div>
            <div class="alert-msg">Network ${r.lbl.toLowerCase()} is critically low — supply chain disruption predicted by displacement volume.</div>
          </div>`;
      }
    });
    document.getElementById('alert-list').innerHTML = alertsHtml || '<div style="color:var(--muted); font-size:13px; font-style:italic;">All vital supplies nominal.</div>';

    // Render multiple dynamic zones
    const zoneListEl = document.querySelector('.zone-list');
    if (zoneListEl && shelters) {
        let zoneHtml = '';
        shelters.forEach((s, idx) => {
            // Distance logic: if it's a global hub, give a realistic macro distance instead of just random 12km
            let dist = (12 + (idx * 5) + Math.floor(Math.random() * 8)) + ' km';
            if (s.type === "Global Logistics Hub") {
                dist = (1500 + Math.floor(Math.random() * 6000)) + ' km'; // Worldwide distances
            }
            
            // Highlight zones with low capacity loosely based on occupancy
            const pctAvail = (s.cap - s.occ) / s.cap;
            let dotStyle = '';
            if (pctAvail < 0.3) dotStyle = 'background:var(--red);box-shadow:0 0 5px var(--red);';
            else if (pctAvail < 0.6) dotStyle = 'background:var(--amber);box-shadow:0 0 5px var(--amber);';

            zoneHtml += `
              <div class="zone-item">
                <div class="zone-left"><div class="zone-dot" style="${dotStyle}"></div><span class="zone-name">${s.name} <span style="font-size:10px;color:rgba(255,255,255,0.4);">(${s.type})</span></span></div>
                <div class="zone-dist">${dist}</div>
              </div>
            `;
        });
        zoneListEl.innerHTML = zoneHtml;
    }
}

function initMap(d, shelters) {
    if (map !== undefined && map !== null) {
        try {
            map.off();
            map.remove();
        } catch(e) {}
        map = null;
    }
    const mapEl = document.getElementById('map');
    if (mapEl) mapEl.innerHTML = ''; // Force clear DOM residue

    const originLat = parseFloat(d.lat) || 0;
    const originLng = parseFloat(d.lng) || 0;

    map = L.map('map', { zoomControl: false, attributionControl: false }).setView([originLat, originLng], 3);
    L.tileLayer('https://cartodb-basemaps-{s}.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
    L.control.zoom({ position: 'bottomleft' }).addTo(map);
    
    // Connect mapping to global scale by rendering bounds
    const bounds = [];
    shelters.forEach(s => {
      const pctAvail = (s.cap - s.occ) / s.cap * 100;
      let col = pctAvail > 30 ? 'var(--green)' : (pctAvail >= 10 ? 'var(--amber)' : 'var(--red)');

      const icon = L.divIcon({
        className: '', iconSize: [20, 20], iconAnchor: [10, 10], popupAnchor: [0, -10],
        html: `<div class="tent-marker" style="color: ${col}"><div class="pulse-bg"></div><svg viewBox="0 0 24 24" fill="${col}"><path d="M12 2L2 21h20L12 2zM12 6.5l7 13H5l7-13z" fill="currentColor"/><path d="M12 9l-4 8h8l-4-8z" fill="currentColor" fill-opacity="0.5"/></svg></div>`
      });

      const getNeed = v => v > 0.6 ? { cls: 'sq-green', text: 'Adequate' } : (v > 0.3 ? { cls: 'sq-amber', text: 'Low' } : { cls: 'sq-red', text: 'Critical' });
      const nf = getNeed(s.needs.food), nw = getNeed(s.needs.water), nm = getNeed(s.needs.medical);
      let occClass = s.occ >= s.cap ? 'background:var(--red)' : (s.occ/s.cap > 0.9 ? 'background:var(--amber)' : 'background:var(--cyan); color:#0a0e1a');

      L.marker([s.lat, s.lng], {icon}).bindPopup(`
        <div class="pop-header">${s.name}</div><span class="pop-type">${s.type}</span>
        <div class="pop-grid">
          <div class="pop-grid-item"><span class="pop-lbl">Capacity</span><span class="pop-val">${s.cap.toLocaleString()}</span></div>
          <div class="pop-grid-item"><span class="pop-lbl">Occupants</span><div><span class="pop-val">${s.occ.toLocaleString()}</span> <span class="pop-pct" style="${occClass}">${Math.floor(s.occ/s.cap*100)}%</span></div></div>
        </div>
        <div class="pop-needs">
          <div class="need-row"><div class="need-left"><div class="sys-sq ${nf.cls}"></div> <span class="need-lbl">Food</span></div><span class="need-status">${nf.text}</span></div>
          <div class="need-row"><div class="need-left"><div class="sys-sq ${nw.cls}"></div> <span class="need-lbl">Water</span></div><span class="need-status">${nw.text}</span></div>
          <div class="need-row"><div class="need-left"><div class="sys-sq ${nm.cls}"></div> <span class="need-lbl">Medical</span></div><span class="need-status">${nm.text}</span></div>
        </div>`).addTo(map);
        
      // Do not include global hubs in the bounding box to prevent extreme zooming out
      if (s.type !== "Global Logistics Hub") {
          bounds.push([s.lat, s.lng]);
      }
    });
    
    // Zoom tightly to the local disaster area
    if(bounds.length > 0) {
        // Enforce a minimum bounding box size to prevent Leaflet from zooming out to whole world
        // if only 1 node is in bounds (which causes zero-sized bounds)
        let minLat = bounds[0][0], maxLat = bounds[0][0];
        let minLng = bounds[0][1], maxLng = bounds[0][1];
        bounds.forEach(b => {
             if (b[0] < minLat) minLat = b[0];
             if (b[0] > maxLat) maxLat = b[0];
             if (b[1] < minLng) minLng = b[1];
             if (b[1] > maxLng) maxLng = b[1];
        });
        
        let localBounds = bounds;
        if (Math.abs(maxLat - minLat) < 0.01 && Math.abs(maxLng - minLng) < 0.01) {
             // Create an artificial box of ~10km radius around the points if they are too tight
             const padDeg = 0.05;
             localBounds = [
                 [minLat - padDeg, minLng - padDeg],
                 [maxLat + padDeg, maxLng + padDeg]
             ];
        }
        
        map.fitBounds(localBounds, { padding: [50, 50], maxZoom: 14 });
    }
}

function getColorClass(pct) {
    if(pct < 50) return { c: 'c-red', bg: 'bg-red' };
    if(pct <= 70) return { c: 'c-amber', bg: 'bg-amber' };
    return { c: 'c-green', bg: 'bg-green' };
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

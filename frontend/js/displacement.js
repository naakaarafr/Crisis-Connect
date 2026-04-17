/**
 * CrisisConnect Displacement Analysis Logic
 * Handles Leaflet map routing, displacement data generation, and sequence animations.
 */

const DISASTERS = [
  {id:1,name:"Türkiye Earthquake",type:"Earthquake",severity:5,lat:37.5,lng:36.8,affected:2400000},
  {id:2,name:"Bangladesh Flooding",type:"Flood",severity:4,lat:23.8,lng:90.4,affected:890000},
  {id:3,name:"California Wildfire",type:"Wildfire",severity:3,lat:34.0,lng:-118.2,affected:145000},
  {id:4,name:"Mozambique Cyclone",type:"Cyclone",severity:4,lat:-19.8,lng:34.9,affected:670000},
  {id:5,name:"Pakistan Heatwave",type:"Heatwave",severity:3,lat:30.3,lng:69.3,affected:320000},
  {id:6,name:"Philippines Typhoon",type:"Typhoon",severity:5,lat:12.8,lng:122.5,affected:1200000},
  {id:7,name:"Peru Landslides",type:"Landslide",severity:2,lat:-9.2,lng:-75.0,affected:45000}
];

let map;
let isPlaying = false;
let animTimers = [];
let leafletRoutes = [];
let bounds = [];

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const paramId = parseInt(urlParams.get('id'));
    const d = DISASTERS.find(x => x.id === paramId) || DISASTERS[0];
    
    document.getElementById('sub-title').innerText = d.name;
    const totalDisplaced = Math.floor(d.affected * 0.35);
    document.getElementById('val-total').innerText = totalDisplaced.toLocaleString();

    const data = generateMockRoutes(d, totalDisplaced);
    initMap(d, data.routes);
    populatePanels(data.origins, data.routes, totalDisplaced);
    initTimestamp();
    
    // Play/Pause Control
    document.getElementById('btn-play-pause').addEventListener('click', () => {
      if(!isPlaying) resumeAnimation();
      else pauseAnimation();
    });

    document.getElementById('btn-anim-seq').addEventListener('click', startSequentialAnimation);

    // Initial state: hide motion but show paths
    setTimeout(() => {
      leafletRoutes.forEach(lr => {
        lr.polyline.getElement().classList.add('route-visible');
        lr.polyline.getElement().style.animationPlayState = 'paused';
        lr.arrow.getElement().style.opacity = 1;
      });
    }, 500);
});

function generateMockRoutes(disaster, totalDisplaced) {
  const origins = [
      { lat: disaster.lat, lng: disaster.lng, name: disaster.name.split(' ')[0] + ' Epicenter', count: Math.floor(totalDisplaced * 0.4) },
      { lat: disaster.lat + 0.5, lng: disaster.lng + 0.3, name: 'Surrounding Districts', count: Math.floor(totalDisplaced * 0.3) },
      { lat: disaster.lat - 0.4, lng: disaster.lng - 0.2, name: 'Coastal/Valley Areas', count: Math.floor(totalDisplaced * 0.3) }
  ];
  origins.sort((a,b) => b.count - a.count);

  const offsetDist = 1.5 + (disaster.severity * 0.5);
  const destNames = ['Safe Zone Alpha', 'Relief Camp Beta', 'Capital City Metro', 'Inland Ridge', 'Southern Evac Hub'];
  const routes = [];
  
  for(let i=0; i<5; i++) {
    const dest = {
      lat: disaster.lat + ((Math.random()-0.5) * offsetDist),
      lng: disaster.lng + ((Math.random()-0.5) * offsetDist),
      name: destNames[i]
    };
    const originObj = origins[i % 3];
    const rCount = Math.floor(totalDisplaced * (0.05 + Math.random()*0.15));
    
    routes.push({
      id: i+1,
      origin: originObj,
      dest: dest,
      count: rCount
    });
  }
  return { origins, routes };
}

function populatePanels(origins, routes, totalDisplaced) {
    // Origins
    const originListHtml = origins.map(o => {
      const pct = (o.count / totalDisplaced) * 100;
      return `
        <div class="origin-item">
          <div class="origin-top"><span>${o.name}</span><span class="origin-count">${o.count.toLocaleString()}</span></div>
          <div class="origin-bar-bg"><div class="origin-bar-fill" style="width: ${pct}%"></div></div>
        </div>`;
    }).join('');
    document.getElementById('origin-list').innerHTML = originListHtml;

    // Routes
    routes.sort((a,b) => b.count - a.count);
    const routeListHtml = routes.map((r, idx) => `
      <div class="route-item" data-idx="${idx}">
        <div class="route-head"><span class="route-num">${idx + 1}</span><span class="route-count">${r.count.toLocaleString()}</span></div>
        <div class="route-path-text"><span>${r.origin.name}</span><span class="route-arrow">▶</span><span style="color: var(--cyan)">${r.dest.name}</span></div>
      </div>`).join('');
    document.getElementById('route-list').innerHTML = routeListHtml;

    // Interactive route list
    const routeDivs = document.querySelectorAll('.route-item');
    routeDivs.forEach(div => {
      div.addEventListener('click', () => {
        routeDivs.forEach(d => d.classList.remove('active'));
        div.classList.add('active');
        leafletRoutes.forEach(lr => lr.polyline.getElement().classList.remove('route-highlight'));
        
        const rItem = leafletRoutes[div.dataset.idx];
        rItem.polyline.getElement().classList.add('route-visible');
        rItem.polyline.getElement().classList.add('route-highlight');
        rItem.arrow.getElement().style.opacity = 1;
        
        map.fitBounds([ 
          [rItem.route.origin.lat, rItem.route.origin.lng], 
          [rItem.route.dest.lat, rItem.route.dest.lng] 
        ], { padding: [100, 100] });
      });
    });
}

function initMap(d, routes) {
    map = L.map('map', { zoomControl: false, attributionControl: false }).setView([d.lat, d.lng], 6);
    L.tileLayer('https://cartodb-basemaps-{s}.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
    L.control.zoom({ position: 'bottomleft' }).addTo(map);

    const drawnOrigins = new Set();
    routes.forEach((r, idx) => {
      const oKey = r.origin.lat + ',' + r.origin.lng;
      if(!drawnOrigins.has(oKey)) {
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

      const poly = L.polyline([[r.origin.lat, r.origin.lng], [r.dest.lat, r.dest.lng]], {
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

    if(bounds.length > 0) map.fitBounds(bounds, { padding: [60, 60] });
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
          if(!isPlaying) return;
          lr.polyline.getElement().classList.add('route-visible');
          lr.arrow.getElement().style.opacity = 1;
        }, 600 * (idx + 1));
        animTimers.push(timer);
    });
    
    const resetTimer = setTimeout(() => { if(isPlaying) pauseAnimation(); }, 600 * (leafletRoutes.length + 2));
    animTimers.push(resetTimer);
}

function pauseAnimation() {
    isPlaying = false;
    formatPlayBtn(false);
    leafletRoutes.forEach(lr => {
        lr.polyline.getElement().style.animationPlayState = 'paused';
    });
}

function resumeAnimation() {
    isPlaying = true;
    formatPlayBtn(true);
    leafletRoutes.forEach(lr => {
        lr.polyline.getElement().style.animationPlayState = 'running';
    });
}

function formatPlayBtn(st) {
    const btn = document.getElementById('btn-play-pause');
    if(st) {
        btn.innerHTML = `<svg viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg> PAUSE`;
        btn.style.color = 'var(--cyan)';
        btn.style.borderColor = 'var(--cyan)';
    } else {
        btn.innerHTML = `<svg viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg> PLAY`;
        btn.style.color = '#fff';
        btn.style.borderColor = 'var(--border)';
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

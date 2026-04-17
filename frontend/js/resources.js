/**
 * CrisisConnect Resource Planning Logic
 * Handles resource capacity overview, critical gap alerts, and shelter mapping.
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

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const paramId = parseInt(urlParams.get('id'));
    const d = DISASTERS.find(x => x.id === paramId) || DISASTERS[0];
    
    document.getElementById('sub-title').innerText = d.name;

    const data = generateResourceData(d);
    initMap(d, data.shelters);
    renderUI(data.resourceOrder);
    initTimestamp();

    // Trigger animations
    setTimeout(() => {
        document.querySelectorAll('.res-bar-fill').forEach(bar => {
          bar.style.width = bar.dataset.w;
        });
    }, 300);
});

function generateResourceData(d) {
    const numShelters = Math.floor(Math.random() * 5) + 8;
    const types = ['Emergency Shelter', 'Medical Post', 'Food Distribution'];
    let totalCap = 0, totalOcc = 0;
    const shelters = [];

    for(let i=0; i<numShelters; i++) {
      const cap = Math.floor(Math.random() * 4500) + 500;
      const occ = Math.floor(cap * (0.4 + Math.random() * 0.7));
      totalCap += cap;
      totalOcc += occ;
      
      shelters.push({
        name: 'Camp ' + ['Alpha','Bravo','Charlie','Delta','Echo'][Math.floor(Math.random()*5)] + '-' + (Math.floor(Math.random()*90)+10),
        type: types[Math.floor(Math.random()*3)],
        lat: d.lat + (Math.random() - 0.5) * 2,
        lng: d.lng + (Math.random() - 0.5) * 2,
        cap, occ,
        needs: { food: Math.random(), water: Math.random(), medical: Math.random() }
      });
    }

    const keys = ['food', 'water', 'medical'].sort(() => 0.5 - Math.random());
    const finalSupplies = {
      [keys[0]]: Math.floor(70 + Math.random() * 20),
      [keys[1]]: Math.floor(20 + Math.random() * 25),
      [keys[2]]: Math.floor(20 + Math.random() * 25),
      shelter: Math.max(0, Math.min(100, Math.floor((1 - (totalOcc/totalCap)) * 100))) 
    };
    if (finalSupplies.shelter < 30) finalSupplies.shelter = Math.floor(30 + Math.random() * 60);

    const resourceOrder = [
      { id: 'food', lbl: 'FOOD SUPPLY', v: finalSupplies.food },
      { id: 'water', lbl: 'WATER SUPPLY', v: finalSupplies.water },
      { id: 'medical', lbl: 'MEDICAL SUPPLY', v: finalSupplies.medical },
      { id: 'shelter', lbl: 'SHELTER SPACES', v: finalSupplies.shelter }
    ];

    return { shelters, resourceOrder };
}

function renderUI(resourceOrder) {
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
            <div class="alert-msg">Network ${r.lbl.toLowerCase()} is ${['critically low', 'depleted', 'in structural deficit'][Math.floor(Math.random()*3)]} — ${Math.floor(Math.random() * 7) + 2} camps currently affected.</div>
          </div>`;
      }
    });
    document.getElementById('alert-list').innerHTML = alertsHtml || '<div style="color:var(--muted); font-size:13px; font-style:italic;">All vital supplies nominal.</div>';
}

function initMap(d, shelters) {
    map = L.map('map', { zoomControl: false, attributionControl: false }).setView([d.lat, d.lng], 7);
    L.tileLayer('https://cartodb-basemaps-{s}.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
    L.control.zoom({ position: 'bottomleft' }).addTo(map);

    const bounds = [];
    shelters.forEach(s => {
      const pctAvail = (s.cap - s.occ) / s.cap * 100;
      let col = pctAvail > 60 ? 'var(--green)' : (pctAvail >= 30 ? 'var(--amber)' : 'var(--red)');

      const icon = L.divIcon({
        className: '', iconSize: [20, 20], iconAnchor: [10, 10], popupAnchor: [0, -10],
        html: `<div class="tent-marker" style="color: ${col}"><div class="pulse-bg"></div><svg viewBox="0 0 24 24" fill="${col}"><path d="M12 2L2 21h20L12 2zM12 6.5l7 13H5l7-13z" fill="currentColor"/><path d="M12 9l-4 8h8l-4-8z" fill="currentColor" fill-opacity="0.5"/></svg></div>`
      });

      const getNeed = v => v > 0.6 ? { cls: 'sq-green', text: 'Adequate' } : (v > 0.3 ? { cls: 'sq-amber', text: 'Low' } : { cls: 'sq-red', text: 'Critical' });
      const nf = getNeed(s.needs.food), nw = getNeed(s.needs.water), nm = getNeed(s.needs.medical);
      let occClass = s.occ > s.cap ? 'background:var(--red)' : (s.occ/s.cap > 0.8 ? 'background:var(--amber)' : 'background:var(--cyan); color:#0a0e1a');

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
      bounds.push([s.lat, s.lng]);
    });
    if(bounds.length > 0) map.fitBounds(bounds, { padding: [50, 50] });
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

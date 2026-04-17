/**
 * CrisisConnect Secondary Risk Assessment Logic
 * Handles mini-map heatmap visualization and risk scoring grids.
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

    initMap(d);
    const risks = calculateRisks(d);
    renderGrid(risks);
    initTimestamp();
});

function initMap(d) {
    map = L.map('map', { 
      zoomControl: false, attributionControl: false, 
      dragging: false, scrollWheelZoom: false, doubleClickZoom: false 
    }).setView([d.lat, d.lng], 7);
    
    L.tileLayer('https://cartodb-basemaps-{s}.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

    const hPoints = [];
    const intensity = d.severity * 0.2;
    hPoints.push([d.lat, d.lng, Math.min(1.0, intensity * 1.5)]);
    
    for(let i=0; i<40; i++) {
       hPoints.push([d.lat + (Math.random()-0.5)*3, d.lng + (Math.random()-0.5)*3, intensity * Math.random()]);
    }
    
    L.heatLayer(hPoints, {
      radius: 40, blur: 35,
      gradient: {0.2:'#FF5500', 0.4:'#00e676', 0.6:'#b2ff59', 0.8:'#ffb340', 1.0:'#ff3b3b'}
    }).addTo(map);
}

function calculateRisks(d) {
    let base = d.severity * 15;
    const riskDefs = [
      { id: 'disease', name: 'Disease Outbreak', score: base + (d.type === 'Earthquake' ? 10 : (d.type === 'Flood' ? 25 : 0)), icon: '<circle cx="12" cy="12" r="5"/><path d="M12 2v2M12 20v2M5 5l1.5 1.5M17.5 17.5L19 19M2 12h2M20 12h2M5 19l1.5-1.5M17.5 6.5L19 5"/>', desc: 'Risk of infectious diseases clustering and spreading rapidly among displaced population brackets.' },
      { id: 'overcrowd', name: 'Overcrowding', score: base + (d.type === 'Cyclone' ? 25 : 15), icon: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>', desc: 'Severe limits on available physical space and privacy for newly evacuated household cohorts.' },
      { id: 'food', name: 'Food Shortage', score: base + (d.type === 'Flood' ? 20 : (d.type === 'Wildfire' ? 15 : 0)), icon: '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>', desc: 'Depleted regional stockpile metrics and completely disrupted supply chain logistics.' },
      { id: 'water', name: 'Water Contamination', score: base + (d.type === 'Flood' ? 35 : (d.type === 'Cyclone' ? 20 : 0)), icon: '<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>', desc: 'Critical systemic breakdown of mass sanitization and potable drinking water infrastructure.' },
      { id: 'mental', name: 'Mental Health Crisis', score: base + 20 + (d.type === 'Wildfire' ? 30 : 0), icon: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>', desc: 'Elevated sustained psychological trauma recorded across all localized affected cohorts.' },
      { id: 'infra', name: 'Infrastructure Collapse', score: base + (d.type === 'Earthquake' ? 30 : 10), icon: '<rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><line x1="9" y1="22" x2="9" y2="2"/><line x1="15" y1="22" x2="15" y2="2"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="7" x2="9" y2="7"/><line x1="4" y1="17" x2="9" y2="17"/><line x1="15" y1="7" x2="20" y2="7"/><line x1="15" y1="17" x2="20" y2="17"/>', desc: 'Continued systemic degradation of critical load-bearing transportation and housing structural assets.' }
    ];

    riskDefs.forEach(r => {
      r.score = Math.max(0, Math.min(100, Math.floor(r.score)));
      if(r.score >= 80) { r.level = 'CRITICAL'; r.cBg = 'var(--red)'; r.tMsg = `↑ +${Math.floor(Math.random()*15 + 10)}% this week`; r.tIco = '<path d="M12 19V5M5 12l7-7 7 7"/>'; r.tCol = 'var(--red)'; } 
      else if(r.score >= 60) { r.level = 'HIGH'; r.cBg = 'var(--amber)'; r.tMsg = `↑ +${Math.floor(Math.random()*10 + 2)}% this week`; r.tIco = '<path d="M12 19V5M5 12l7-7 7 7"/>'; r.tCol = 'var(--amber)'; } 
      else if(r.score >= 40) { r.level = 'MEDIUM'; r.cBg = '#2979ff'; r.tMsg = `→ Stable trajectory`; r.tIco = '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>'; r.tCol = '#2979ff'; } 
      else { r.level = 'LOW'; r.cBg = 'var(--green)'; r.tMsg = `↓ -${Math.floor(Math.random()*5 + 1)}% improving`; r.tIco = '<path d="M12 5v14M5 12l7 7 7-7"/>'; r.tCol = 'var(--green)'; }
      r.cBorder = r.cBg;
    });
    return riskDefs;
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

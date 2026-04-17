/**
 * CrisisConnect Disaster Intelligence Logic
 * Handles Leaflet map, disaster data rendering, and detailed panel interactions.
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

// Type Colors map
const typeBg = {
  'Earthquake': 'rgba(255, 59, 59, 0.2)',
  'Flood': 'rgba(41, 121, 255, 0.2)',
  'Wildfire': 'rgba(255, 109, 0, 0.2)',
  'Cyclone': 'rgba(213, 0, 249, 0.2)',
  'Heatwave': 'rgba(255, 171, 0, 0.2)',
  'Typhoon': 'rgba(0, 191, 165, 0.2)',
  'Landslide': 'rgba(160, 136, 112, 0.2)'
};
const typeBorder = {
  'Earthquake': '#ff3b3b',
  'Flood': '#2979ff',
  'Wildfire': '#ff6d00',
  'Cyclone': '#d500f9',
  'Heatwave': '#ffab00',
  'Typhoon': '#00bfa5',
  'Landslide': '#A08870'
};

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const paramId = parseInt(urlParams.get('id'));
    const d = DISASTERS.find(x => x.id === paramId) || DISASTERS[0];

    initPanel(d);
    initMap(d);
    initTabs();
    initTimestamp();
});

function initPanel(d) {
    // Populate Header
    document.getElementById('d-title').innerText = d.name;
    const badge = document.getElementById('d-type');
    badge.innerText = d.type.toUpperCase();
    badge.style.background = typeBg[d.type] || 'rgba(255,255,255,0.1)';
    badge.style.borderColor = typeBorder[d.type] || '#fff';
    badge.style.color = typeBorder[d.type] || '#fff';

    // Severity Blocks
    const sevContainer = document.getElementById('d-sev-blocks');
    sevContainer.innerHTML = '';
    for(let i=1; i<=5; i++) {
      const block = document.createElement('div');
      block.className = 'sev-block';
      if(i <= d.severity) {
        if(d.severity === 5) block.classList.add('filled-red');
        else if(d.severity >= 3) block.classList.add('filled-amber');
        else block.classList.add('filled-cyan');
      }
      sevContainer.appendChild(block);
    }

    // Status Badge
    const statusBadg = document.getElementById('d-status');
    const statusText = document.getElementById('d-status-text');
    const statusDot = document.getElementById('d-status-dot');
    
    if(d.severity >= 4) {
      statusBadg.className = 'status-badge status-critical';
      statusText.innerText = 'CRITICAL';
      statusDot.style.backgroundColor = 'var(--red)';
      statusDot.style.boxShadow = '0 0 8px var(--red)';
    } else if(d.severity === 3) {
      statusBadg.className = 'status-badge status-warning';
      statusText.innerText = 'WARNING';
      statusDot.style.backgroundColor = 'var(--amber)';
      statusDot.style.boxShadow = '0 0 8px var(--amber)';
    } else {
      statusBadg.className = 'status-badge status-monitoring';
      statusText.innerText = 'MONITORING';
      statusDot.style.backgroundColor = 'var(--cyan)';
      statusDot.style.boxShadow = '0 0 8px var(--cyan)';
    }

    // Dynamic Stats
    const deaths = Math.floor(d.severity * d.severity * 800 + Math.random() * 500);
    const injured = deaths * 4;
    const displaced = Math.floor(d.affected * 0.3);
    const infrastructure = d.severity * 18;
    const fakeDaysDur = Math.floor(Math.random() * 14) + 1;
    const fakeArea = (d.severity * 1450).toLocaleString();
    
    document.getElementById('grid-loc').innerText = d.name.split(' ')[0];
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - fakeDaysDur);
    document.getElementById('grid-date').innerText = startDate.toISOString().split('T')[0];
    document.getElementById('grid-area').innerText = fakeArea;
    document.getElementById('grid-pop').innerText = d.affected.toLocaleString();
    document.getElementById('grid-coord').innerText = `${d.lat.toFixed(4)}, ${d.lng.toFixed(4)}`;
    document.getElementById('grid-dur').innerText = fakeDaysDur;

    // Impact
    document.getElementById('imp-deaths').innerText = deaths.toLocaleString();
    document.getElementById('imp-injured').innerText = injured.toLocaleString();
    document.getElementById('imp-displaced').innerText = displaced.toLocaleString();
    document.getElementById('imp-infra').innerText = infrastructure + '%';

    // Description & Facts
    const descriptions = {
      'Earthquake': 'A powerful seismic event striking the regional fault line, causing widespread structural failure and severing main logistics corridors.',
      'Flood': 'Unprecedented rainfall leading to overflowing riverbanks. Low-lying areas are completely submerged, forcing rapid evacuation protocols.',
      'Wildfire': 'Extreme dry conditions and high winds have fueled a massive wildfire front. Air quality is hazardous and evacuation orders are expanding.',
      'Cyclone': 'A severe tropical cyclone making landfall with catastrophic wind speeds. Storm surges threaten coastal communities.',
      'Heatwave': 'A prolonged period of extreme temperatures causing severe strain on power grids and public health infrastructure.',
      'Typhoon': 'A catastrophic typhoon system bringing torrential rain, leading to severe flooding and destructive wind damage.',
      'Landslide': 'Heavy precipitation causing slope instability. Major roadways blocked and remote villages are currently inaccessible.'
    };
    
    document.getElementById('tab-desc').innerText = descriptions[d.type] || 'Critical multi-hazard event currently under intelligence monitoring.';
    
    const factsHtml = [];
    if(d.type === 'Earthquake') factsHtml.push(`<li class="fact-item"><span class="fact-label">Magnitude</span><span class="fact-val">${(d.severity*1.5).toFixed(1)} Mw</span></li>`, `<li class="fact-item"><span class="fact-label">Depth</span><span class="fact-val">${Math.floor(12 + Math.random()*10)} km</span></li>`);
    else if(d.type === 'Cyclone' || d.type === 'Typhoon') factsHtml.push(`<li class="fact-item"><span class="fact-label">Wind Speed</span><span class="fact-val">${150 + d.severity*20} km/h</span></li>`, `<li class="fact-item"><span class="fact-label">Category</span><span class="fact-val">CAT ${d.severity}</span></li>`);
    else if(d.type === 'Wildfire') factsHtml.push(`<li class="fact-item"><span class="fact-label">Containment</span><span class="fact-val">${(5 - d.severity)*15}%</span></li>`, `<li class="fact-item"><span class="fact-label">Burn Area</span><span class="fact-val">${d.severity * 40}k Acres</span></li>`);
    else factsHtml.push(`<li class="fact-item"><span class="fact-label">Intensity</span><span class="fact-val">Level ${d.severity}</span></li>`, `<li class="fact-item"><span class="fact-label">Trajectory</span><span class="fact-val">Expanding</span></li>`);
    
    document.getElementById('tab-facts').innerHTML = factsHtml.join('');

    // Timeline
    const timelines = [
      { time: 'T-0', desc: `${d.type} strikes epicenter coordinate ${d.lat.toFixed(2)}, ${d.lng.toFixed(2)}.` },
      { time: 'T+2 hrs', desc: `First responder units deployed. Assessment satellites repositioned.` },
      { time: `T+${fakeDaysDur > 1 ? fakeDaysDur-1 : 1} days`, desc: `National emergency declared. International aid requested.` },
      { time: 'CURRENT', desc: `Rescue ops ongoing. Critical infrastructure integrity at ${100-infrastructure}% stable.` }
    ];
    
    document.getElementById('tab-timeline').innerHTML = timelines.map(t => `
      <div class="time-event">
        <div class="event-time">${t.time}</div>
        <div class="event-desc">${t.desc}</div>
      </div>
    `).join('');
}

function initMap(d) {
    const map = L.map('map', { zoomControl: false, attributionControl: false }).setView([d.lat, d.lng], 8);
    
    L.tileLayer('https://cartodb-basemaps-{s}.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png', {
      maxZoom: 19
    }).addTo(map);
    
    L.control.zoom({ position: 'bottomleft' }).addTo(map);

    // Overlay severity circle
    let rad = 60000, col = '#ffff00', op = 0.10;
    if(d.severity === 5) { rad = 150000; col = '#ff3b3b'; op = 0.12; }
    else if(d.severity === 4) { rad = 100000; col = '#ffb340'; op = 0.12; }

    L.circle([d.lat, d.lng], {
      color: col, fillColor: col, fillOpacity: op, weight: 1
    }).addTo(map);

    // Marker
    let sevClass = d.severity === 5 ? 'sev-5' : (d.severity >= 3 ? 'sev-3' : 'sev-1');
    const icon = L.divIcon({
      html: `<div class="pulse-marker ${sevClass}"><div class="pulse-ring"></div><div class="pulse-dot"></div></div>`,
      className: '', iconSize: [24, 24], iconAnchor: [12, 12]
    });
    L.marker([d.lat, d.lng], {icon}).addTo(map);
}

function initTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    const panes = document.querySelectorAll('.tab-pane');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        panes.forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById('pane-' + tab.dataset.tab).classList.add('active');
      });
    });
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

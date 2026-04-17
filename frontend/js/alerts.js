/**
 * CrisisConnect Alerts Feed Logic
 * Manages real-time alert stream, filtering, and detail panel interactions.
 */

const DISASTERS = [
  {id:1,name:"Türkiye Earthquake",type:"Earthquake",hub:"Kahramanmaraş",severity:5,lat:37.5,lng:36.8,affected:2400000},
  {id:2,name:"Bangladesh Flooding",type:"Flood",hub:"Sylhet District",severity:4,lat:23.8,lng:90.4,affected:890000},
  {id:3,name:"California Wildfire",type:"Wildfire",hub:"Los Angeles County",severity:3,lat:34.0,lng:-118.2,affected:145000},
  {id:4,name:"Mozambique Cyclone",type:"Cyclone",hub:"Beira Coast",severity:4,lat:-19.8,lng:34.9,affected:670000},
  {id:5,name:"Pakistan Heatwave",type:"Heatwave",hub:"Jacobabad",severity:3,lat:30.3,lng:69.3,affected:320000},
  {id:6,name:"Philippines Typhoon",type:"Typhoon",hub:"Leyte Bay",severity:5,lat:12.8,lng:122.5,affected:1200000},
  {id:7,name:"Peru Landslides",type:"Landslide",hub:"Huanuco Valley",severity:2,lat:-9.2,lng:-75.0,affected:45000}
];

const ICONS = {
  Earthquake: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  Flood: '<path d="M2 12h4l3-9 5 15 3-9h5"/><path d="M2 18h20"/>',
  Wildfire: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  Cyclone: '<path d="M12 22a10 10 0 1 1 10-10 M12 18a6 6 0 1 1 6-6 M12 14a2 2 0 1 1 2-2"/>',
  Default: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>'
};

const TEMPLATES = [
  { t: "NEW DISASTER DETECTED", s: "CRITICAL", msg: "Immediate catastrophic event registered globally. Awaiting full seismic verification." },
  { t: "SEVERITY ESCALATED", s: "WARNING", msg: "Local parameter thresholds exceeded historical limits. Evacuation highly recommended." },
  { t: "RESOURCE SHORTAGE", s: "WARNING", msg: "Critical depletion of baseline medical and food provisions across local triage centers." },
  { t: "DISPLACEMENT SURGE", s: "INFO", msg: "Unexpected mass civilian migration flows observed outward from epicenter coordinates." },
  { t: "ALL-CLEAR ISSUED", s: "RESOLVED", msg: "Secondary threat levels stabilized. Relief teams advancing to recovery phase operations." },
  { t: "COMMUNICATION RESTORED", s: "RESOLVED", msg: "Primary satellite downlinks re-established across zone zero command posts." }
];

let sysAlerts = [];
let currentFilter = 'ALL';
let unreadCount = 0;
let autoRefresh = true;
let activeCard = null;

document.addEventListener('DOMContentLoaded', () => {
    generateInitial();
    initFilters();
    initRefreshToggle();
    initTimestamp();
    initDetailPanel();
    renderFeed();
    startRefreshInterval();
});

function generateInitial() {
    const nowTs = Date.now();
    for(let i=0; i<20; i++) {
        const d = DISASTERS[Math.floor(Math.random() * DISASTERS.length)];
        const tmp = TEMPLATES[Math.floor(Math.random() * TEMPLATES.length)];
        
        let sevClass = tmp.s;
        if(d.severity >= 4 && Math.random()>0.5 && sevClass!=='RESOLVED') sevClass = 'CRITICAL';

        const tDiff = Math.floor(Math.random() * 360 * 60000) + 120000; 
        
        sysAlerts.push({
          id: 'A'+Math.floor(Math.random()*999999),
          disaster: d,
          title: tmp.t,
          category: sevClass,
          desc: tmp.msg,
          timestamp: nowTs - tDiff,
          isNew: false
        });
    }
    sysAlerts.sort((a,b)=> b.timestamp - a.timestamp);
}

function getTimeStr(ms) {
    const diff = Math.floor((Date.now() - ms) / 60000);
    if(diff < 1) return `JUST NOW`;
    if(diff < 60) return `${diff} MIN AGO`;
    const hrs = Math.floor(diff/60);
    return `${hrs} HR AGO`;
}

function getClasses(sev) {
    if(sev==='CRITICAL') return { c: 'sev-critical', bg: 'bg-critical', bc: 'var(--red)' };
    if(sev==='WARNING') return { c: 'sev-warning', bg: 'bg-warning', bc: 'var(--amber)' };
    if(sev==='RESOLVED') return { c: 'sev-resolved', bg: 'bg-resolved', bc: 'var(--green)' };
    return { c: 'sev-info', bg: 'bg-info', bc: 'var(--cyan)' }; 
}

function renderFeed() {
    const feed = document.getElementById('alert-feed');
    const empty = document.getElementById('empty-state');
    
    const filtered = sysAlerts.filter(a => currentFilter === 'ALL' || a.category === currentFilter);
    
    if(filtered.length === 0) {
        feed.style.display = 'none';
        empty.classList.add('show');
    } else {
        feed.style.display = 'flex';
        empty.classList.remove('show');
        
        feed.innerHTML = filtered.map(a => {
            const col = getClasses(a.category);
            const iconPath = ICONS[a.disaster.type] || ICONS.Default;
            
            let aClass = 'alert-card';
            if(a.isNew) aClass += ' card-animate';
            
            return `
              <div class="${aClass}" data-id="${a.id}" onclick="openDetail('${a.id}')">
                <div class="border-left" style="background-color: ${col.bc}; ${a.isNew && a.category==='CRITICAL' ? `box-shadow: 0 0 15px ${col.bc}` : ''}"></div>
                
                <div class="alert-layout">
                  <div class="icon-wrapper" style="background: rgba(10,6,3,0.5); color: ${col.bc};">
                    <svg viewBox="0 0 24 24">${iconPath}</svg>
                  </div>
                  
                  <div class="alert-core">
                    <div class="alert-title">${a.title}</div>
                    <div class="alert-meta">
                      <span style="color:${col.bc}">${a.disaster.type}</span> <span class="bull">•</span> ${a.disaster.hub} <span class="bull">•</span> SOURCE: SATELLITE COM
                    </div>
                    <div class="alert-desc">${a.desc}</div>
                  </div>
                  
                  <div class="alert-right">
                    <div class="alert-time">${getTimeStr(a.timestamp)}</div>
                    <div class="alert-pill ${col.bg}">${a.category}</div>
                    <div class="view-link" style="color:${col.bc}">VIEW →</div>
                  </div>
                </div>
              </div>
            `;
        }).join('');
    }

    updateBadges();
}

function updateBadges() {
    const counts = { ALL: sysAlerts.length, CRITICAL: 0, WARNING: 0, INFO: 0, RESOLVED: 0 };
    sysAlerts.forEach(a => { counts[a.category]++; });
    
    document.getElementById('c-all').innerText = counts.ALL;
    document.getElementById('c-crit').innerText = counts.CRITICAL;
    document.getElementById('c-warn').innerText = counts.WARNING;
    document.getElementById('c-info').innerText = counts.INFO;
    document.getElementById('c-res').innerText = counts.RESOLVED;

    const nb = document.getElementById('nav-badge');
    nb.innerText = Math.min(99, 3 + unreadCount);
}

function initFilters() {
    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
          document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
          currentFilter = tab.dataset.filter;
          renderFeed();
          document.getElementById('detail-panel').classList.remove('open');
        });
      });
}

function initRefreshToggle() {
    const btnRefresh = document.getElementById('auto-refresh-btn');
    btnRefresh.addEventListener('click', () => {
        autoRefresh = !autoRefresh;
        if(autoRefresh) btnRefresh.classList.remove('off');
        else btnRefresh.classList.add('off');
    });
}

function startRefreshInterval() {
    setInterval(() => {
        if(!autoRefresh) return;
        document.getElementById('txt-last').innerText = `LAST REFRESH: ${new Date().toLocaleTimeString()}`;
        
        if(Math.random() < 0.40) {
          sysAlerts.forEach(a => a.isNew = false);
          
          const d = DISASTERS[Math.floor(Math.random() * DISASTERS.length)];
          const tmp = TEMPLATES[Math.floor(Math.random() * TEMPLATES.length)];
          let sevClass = tmp.s;
          if(d.severity >= 4 && Math.random()>0.5 && sevClass!=='RESOLVED') sevClass = 'CRITICAL';
  
          const newAlert = {
            id: 'A'+Math.floor(Math.random()*999999),
            disaster: d,
            title: tmp.t,
            category: sevClass,
            desc: "AUTO-GENERATED: " + tmp.msg,
            timestamp: Date.now(),
            isNew: true
          };
  
          sysAlerts.unshift(newAlert);
          if(sysAlerts.length > 50) sysAlerts.pop();
          
          unreadCount++;
          const bdg = document.getElementById('nav-badge');
          bdg.classList.add('pop');
          setTimeout(()=> bdg.classList.remove('pop'), 300);
          renderFeed();
        } else {
          renderFeed(); 
        }
    }, 15000);
}

function initDetailPanel() {
    document.getElementById('dp-close').addEventListener('click', () => {
        document.getElementById('detail-panel').classList.remove('open');
        if(activeCard) activeCard.classList.remove('active');
    });
}

window.openDetail = (id) => {
    const alt = sysAlerts.find(a => a.id === id);
    if(!alt) return;

    document.querySelectorAll('.alert-card').forEach(c => c.classList.remove('active'));
    const tgt = document.querySelector(`.alert-card[data-id="${id}"]`);
    if(tgt) { tgt.classList.add('active'); activeCard = tgt; }
    
    const col = getClasses(alt.category);
    const dPanel = document.getElementById('detail-panel');

    document.getElementById('dp-type').innerText = alt.disaster.type;
    document.getElementById('dp-type').style.color = col.bc;
    document.getElementById('dp-title').innerText = alt.disaster.name;
    document.getElementById('dp-desc').innerText = alt.desc + " Additional automated intelligence protocols have verified the payload. Ground teams have been notified across the regional hub.";
    
    document.getElementById('dp-aff').innerText = alt.disaster.affected.toLocaleString();
    document.getElementById('dp-coords').innerText = `${alt.disaster.lat}°N, ${alt.disaster.lng}°E`;
    document.getElementById('dp-hub').innerText = alt.disaster.hub;
    
    const btnMap = document.getElementById('btn-view-map');
    btnMap.href = `disaster.html?id=${alt.disaster.id}`;
    btnMap.style.backgroundColor = col.bc;
    btnMap.style.boxShadow = `0 0 15px ${col.bg}`;

    document.getElementById('btn-view-res').href = `resources.html?id=${alt.disaster.id}`;
    
    const sev = alt.disaster.severity;
    document.getElementById('dp-gauge-text').innerText = sev.toFixed(1);
    const dashLimit = (sev/5) * 157;
    let gc = 'var(--cyan)';
    if(sev>=3) gc = 'var(--amber)';
    if(sev>=4) gc = 'var(--red)';
    
    const path = document.getElementById('dp-gauge-path');
    path.style.stroke = gc;
    path.style.strokeDasharray = '0, 157';
    setTimeout(()=> { path.style.strokeDasharray = `${dashLimit}, 157`; }, 100);
    
    const statB = document.getElementById('dp-status-badge');
    if(alt.category === 'RESOLVED') {
      statB.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3" stroke="#000" stroke-width="2" fill="none"/></svg> STABILIZED';
      statB.style.color = 'var(--green)'; statB.style.borderColor = 'var(--green)'; statB.style.background = 'rgba(0,230,118,0.1)';
    } else if(alt.category === 'CRITICAL' || alt.category === 'WARNING') {
      statB.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> ESCALATING';
      statB.style.color = 'var(--red)'; statB.style.borderColor = 'var(--red)'; statB.style.background = 'rgba(255,59,59,0.1)';
    } else {
      statB.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> MONITORING';
      statB.style.color = 'var(--cyan)'; statB.style.borderColor = 'var(--cyan)'; statB.style.background = 'rgba(255,85,0,0.1)';
    }

    dPanel.classList.add('open');
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

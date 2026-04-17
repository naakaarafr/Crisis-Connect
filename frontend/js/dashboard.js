/**
 * CrisisConnect Dashboard Logic
 * Handles Globe.gl 3D map initialization, disaster markers, and UI overlays.
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

let globe;
let heatmapActive = false;

document.addEventListener('DOMContentLoaded', () => {
    initGlobe();
    updateStats();
    initControls();
    initFeed(); // from previous widget logic via html integration
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
                     if(tl[nm]) return tl[nm];
                     return cPal[(nm ? nm.charCodeAt(0) + nm.charCodeAt(nm.length-1) : 0) % cPal.length];
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
        DISASTERS.forEach(d => {
            const intensity = d.severity; // 1-5
            heatData.push({ lat: d.lat, lng: d.lng, maxR: intensity * 2, color: intensity >= 4 ? '#ff003c' : '#ff8800' });
            for(let i=0; i<3; i++) {
                heatData.push({
                    lat: d.lat + (Math.random()-0.5)*5, 
                    lng: d.lng + (Math.random()-0.5)*5,
                    maxR: intensity * 1.5,
                    color: intensity >= 4 ? '#ff2200' : '#ff6600'
                });
            }
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

function updateStats() {
    const activeEl = document.getElementById('stat-active');
    const affectedEl = document.getElementById('stat-affected');
    const critEl = document.getElementById('stat-critical');
    
    if (!activeEl) return;

    const totalAffected = DISASTERS.reduce((s, d) => s + d.affected, 0);
    const criticalCount = DISASTERS.filter(d => d.severity >= 4).length;

    activeEl.innerText = DISASTERS.length;
    affectedEl.innerText = totalAffected.toLocaleString();
    critEl.innerText = criticalCount;
    
    [activeEl, affectedEl, critEl].forEach(el => {
        el.style.animation = 'none';
        el.offsetHeight; 
        el.style.animation = 'flicker 2s';
    });
}

function initControls() {
    const btnHeatmap = document.getElementById('btn-heatmap');
    if (btnHeatmap) {
        btnHeatmap.addEventListener('click', function() {
            heatmapActive = !heatmapActive;
            if(heatmapActive) {
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

    const btnRefresh = document.getElementById('btn-refresh');
    if (btnRefresh) {
        btnRefresh.addEventListener('click', function() {
            const svg = this.querySelector('svg');
            if (svg) svg.style.animation = 'spin 1s linear infinite';
            updateStats();
            setTimeout(() => { if (svg) svg.style.animation = 'none'; }, 1000);
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
    
    document.getElementById('p-affected').innerText = d.affected.toLocaleString();
    document.getElementById('p-btn').href = 'disaster.html?v=2.0&id=' + d.id;
    
    panel.classList.add('show');
}

// Relocated Live Feed Ticker functional logic from HTML
function initFeed() {
    const events = [
      "SITUATION_RED: Khartoum sector unstable.",
      "INTEL_UPDATE: Thermal signature detected.",
      "ZONE_ALERT: Air defense active over Haifa.",
      "NAV_NOTICE: Taiwan Strait movement."
    ];
    const feed = document.getElementById('live-feed-globe');
    if (!feed) return;
    setInterval(() => {
        const text = events[Math.floor(Math.random() * events.length)];
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        feed.innerHTML = `<div class="event-item"><span class="event-time">[${time}]</span> <span class="event-text">${text}</span></div>` + feed.innerHTML;
        if (feed.children.length > 5) feed.removeChild(feed.lastChild);
    }, 4000);
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    feed.innerHTML = `<div class="event-item"><span class="event-time">[${time}]</span> <span class="event-text">SITLINK ESTABLISHED.</span></div>`;
}

let map, userMarker, userLocation = null;
let scannedMarkers = [];
let radarCircle = null;

document.addEventListener('DOMContentLoaded', () => {
    initMap();
    trackLocation();
    updateNetworkStatus();
    initSOSControls();
    
    // UI Timestamp helper
    setInterval(() => {
        const timeEl = document.getElementById('pos-time');
        if (timeEl && userLocation) {
            timeEl.textContent = new Date().toLocaleTimeString();
        }
    }, 1000);
});

function initMap() {
    const defaultLoc = [28.6139, 77.2090]; // New Delhi
    
    map = L.map('map', {
        zoomControl: false,
        attributionControl: false
    }).setView(defaultLoc, 13);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19
    }).addTo(map);

    // Initial User Marker
    const userIcon = L.divIcon({
        className: 'user-marker-container',
        html: '<div class="user-marker-pulse"></div>',
        iconSize: [24, 24],
        iconAnchor: [12, 12]
    });

    userMarker = L.marker(defaultLoc, { icon: userIcon }).addTo(map);
}

window.toggle3D = function() {
    // Leaflet is 2D, so we emulate dynamic tilt if possible or just zoom
    map.setZoom(map.getZoom() + 1);
}

window.toggleRadar = function() {
    const radar = document.getElementById('radar');
    const isActive = radar.style.display === 'block';
    
    if (!isActive) {
        radar.style.display = 'block';
        if (userLocation) {
            radarCircle = L.circle([userLocation.lat, userLocation.lng], {
                radius: 1000,
                color: '#00ffff',
                fillColor: '#00ffff',
                fillOpacity: 0.1,
                weight: 1
            }).addTo(map);
        }
        generateMockTacticalData();
    } else {
        radar.style.display = 'none';
        if (radarCircle) map.removeLayer(radarCircle);
        clearTacticalData();
    }
}

function generateMockTacticalData() {
    clearTacticalData();
    if (!userLocation) return;

    for (let i = 0; i < 5; i++) {
        const dLat = (Math.random() - 0.5) * 0.02;
        const dLng = (Math.random() - 0.5) * 0.02;
        
        const assetIcon = L.divIcon({
            className: 'tactical-asset-icon',
            html: '<div class="asset-marker"></div>',
            iconSize: [12, 12]
        });

        const marker = L.marker([userLocation.lat + dLat, userLocation.lng + dLng], { icon: assetIcon })
            .bindPopup(`<b>ASSET CODE: X-${Math.floor(Math.random()*999)}</b><br>STATUS: ACTIVE`)
            .addTo(map);
        
        scannedMarkers.push(marker);
    }
}

function clearTacticalData() {
    scannedMarkers.forEach(m => map.removeLayer(m));
    scannedMarkers = [];
}

window.recenterMap = function() {
    if (userLocation) {
        map.flyTo([userLocation.lat, userLocation.lng], 16, {
            duration: 2
        });
    }
}

function trackLocation() {
    if (!navigator.geolocation) return;

    navigator.geolocation.watchPosition(
        (pos) => {
            const { latitude, longitude } = pos.coords;
            userLocation = { lat: latitude, lng: longitude };
            
            if (userMarker) {
                userMarker.setLatLng([latitude, longitude]);
            }
            
            document.getElementById('pos-lat').textContent = latitude.toFixed(6);
            document.getElementById('pos-lng').textContent = longitude.toFixed(6);
            
            updateSignalUI(98, "OPTIMAL");
            
            if (!map._firstJump) {
                recenterMap();
                map._firstJump = true;
            }
        },
        (err) => {
            console.warn("Location error:", err);
            updateSignalUI(15, "DEGRADED");
        },
        { enableHighAccuracy: true }
    );
}

function updateSignalUI(strength, status) {
    const el = document.getElementById('signal-strength');
    if (el) {
        el.textContent = `${strength}% [${status}]`;
        el.style.color = strength > 50 ? '#00ff00' : '#ffcc00';
    }
}

function initSOSControls() {
    const sosTrigger = document.getElementById('sos-trigger');
    const modal = document.getElementById('confirm-modal');
    const btnConfirm = document.getElementById('btn-confirm');
    const btnCancel = document.getElementById('btn-cancel');

    if (sosTrigger) {
        sosTrigger.addEventListener('click', () => {
            if (sosTrigger.classList.contains('sent')) return;
            modal.style.display = 'flex';
        });
    }

    if (btnCancel) {
        btnCancel.onclick = () => modal.style.display = 'none';
    }

    if (btnConfirm) {
        btnConfirm.addEventListener('click', () => {
            modal.style.display = 'none';
            initiateSOSBroadcast();
        });
    }
}

async function initiateSOSBroadcast() {
    const sosTrigger = document.getElementById('sos-trigger');
    const statusEl = document.getElementById('sos-status');
    
    if (statusEl) {
        statusEl.textContent = 'SOS SIGNAL BROADCASTING';
        statusEl.style.color = '#ff3b3b';
    }
    
    if (sosTrigger) {
        sosTrigger.classList.add('sent');
        sosTrigger.innerHTML = '<span>SENT</span>';
    }

    map.flyTo([userLocation.lat, userLocation.lng], 18, {
        duration: 4
    });

    const list = document.getElementById('alerts-list');
    if (list) {
        const card = document.createElement('div');
        card.className = 'alert-card';
        card.style.borderLeft = '3px solid #ff3b3b';
        card.innerHTML = `<strong>URGENT ALERT:</strong> SOS Broadcast active from this node.<br><small>${new Date().toLocaleTimeString()}</small>`;
        list.prepend(card);
    }
}

function updateNetworkStatus() {
    const dot = document.getElementById('status-dot');
    const text = document.getElementById('status-text');
    if (!dot || !text) return;

    if (navigator.onLine) {
        dot.className = 'status-dot';
        text.textContent = 'ONLINE';
    } else {
        dot.className = 'status-dot offline';
        text.textContent = 'OFFLINE';
    }
}

window.addEventListener('online', updateNetworkStatus);
window.addEventListener('offline', updateNetworkStatus);

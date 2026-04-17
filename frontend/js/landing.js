/**
 * CrisisConnect Landing Page Logic
 * Handles Mapbox GL JS, Geolocation, and SOS Tactical Actions.
 */

// --- CONFIGURATION ---
// Replace with your Mapbox Public Token
const MAPBOX_TOKEN = 'pk.eyJ1IjoiY3Jpc2lzY29ubmVjdCIsImEiOiJjbHU0cmV4YmkwMnB0MmxvNXBoZnZ5ZndrIn0.V8W5vY1-Yy0Y0vYvYvYv';
mapboxgl.accessToken = MAPBOX_TOKEN;

let map, userMarker, userLocation = null;
let watchId = null;

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    startTracking();
    checkConnectivity();
    initSOS();

    // Listen for network changes
    window.addEventListener('online', checkConnectivity);
    window.addEventListener('offline', checkConnectivity);
});

function initMap() {
    // Default location (fallback)
    const defaultCoords = [77.2090, 28.6139]; // New Delhi

    map = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/mapbox/navigation-night-v1',
        center: defaultCoords,
        zoom: 12,
        pitch: 45,
        bearing: -17,
        antialias: true
    });

    // Add navigation controls
    map.addControl(new mapboxgl.NavigationControl(), 'top-left');

    // Create User Marker (Blue by default)
    const el = document.createElement('div');
    el.className = 'map-marker user-live';
    el.style.width = '20px';
    el.style.height = '20px';
    el.style.borderRadius = '50%';
    el.style.backgroundColor = '#00e676'; // Green dot
    el.style.boxShadow = '0 0 15px #00e676';
    el.style.border = '3px solid #fff';

    userMarker = new mapboxgl.Marker(el)
        .setLngLat(defaultCoords)
        .addTo(map);

    // Initial check for last known location
    const lastKnown = localStorage.getItem('cc_last_location');
    if (lastKnown) {
        const data = JSON.parse(lastKnown);
        updateUI(data.lat, data.lng, data.timestamp, true);
        map.jumpTo({ center: [data.lng, data.lat], zoom: 14 });
    }
}

// --- GEOLOCATION ---
function startTracking() {
    if (!navigator.geolocation) {
        console.error("Geolocation is not supported by this browser.");
        return;
    }

    watchId = navigator.geolocation.watchPosition(
        (position) => {
            const { latitude, longitude } = position.coords;
            const timestamp = new Date().toISOString();

            userLocation = { lat: latitude, lng: longitude };
            
            // Save to localStorage
            localStorage.setItem('cc_last_location', JSON.stringify({
                lat: latitude,
                lng: longitude,
                timestamp: timestamp
            }));

            if (navigator.onLine) {
                updateUI(latitude, longitude, timestamp, false);
            }
        },
        (error) => {
            console.warn("Geolocation Error:", error.message);
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }
    );
}

function updateUI(lat, lng, time, isOffline) {
    // Update Marker Position
    if (userMarker) {
        userMarker.setLngLat([lng, lat]);
        const el = userMarker.getElement();
        
        if (isOffline) {
            el.style.backgroundColor = '#888';
            el.style.boxShadow = '0 0 10px #555';
        } else {
            el.style.backgroundColor = '#00e676';
            el.style.boxShadow = '0 0 15px #00e676';
        }
    }

    // Update Info Card
    const coordsEl = document.getElementById('pos-coords');
    const timeEl = document.getElementById('pos-time');

    if (coordsEl) coordsEl.textContent = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    if (timeEl) timeEl.textContent = new Date(time).toLocaleTimeString();

    // Smooth Camera Movement
    if (map && !isOffline) {
        map.flyTo({
            center: [lng, lat],
            zoom: 15,
            speed: 0.8,
            curve: 1,
            essential: true
        });
    }
}

// --- CONNECTIVITY ---
function checkConnectivity() {
    const statusDot = document.querySelector('.status-dot');
    const statusText = document.getElementById('status-text');

    if (navigator.onLine) {
        statusDot.classList.remove('offline');
        statusText.textContent = "ONLINE";
        console.log("System Online: Resuming data uplink...");
        
        // Re-sync UI if we have a location
        if (userLocation) {
            updateUI(userLocation.lat, userLocation.lng, new Date().toISOString(), false);
        }
    } else {
        statusDot.classList.add('offline');
        statusText.textContent = "OFFLINE";
        console.log("System Offline: Displaying last known tactical data.");

        const lastKnown = localStorage.getItem('cc_last_location');
        if (lastKnown) {
            const data = JSON.parse(lastKnown);
            updateUI(data.lat, data.lng, data.timestamp, true);
        }
    }
}

// --- SOS LOGIC ---
function initSOS() {
    const trigger = document.getElementById('sos-trigger');
    const modal = document.getElementById('sos-modal');
    const cancel = document.getElementById('sos-cancel');
    const confirm = document.getElementById('sos-confirm');
    const statusEl = document.getElementById('sos-status');

    if (!trigger) return;

    trigger.addEventListener('click', () => {
        if (trigger.classList.contains('sent')) return;
        modal.style.display = 'flex';
    });

    cancel.addEventListener('click', () => {
        modal.style.display = 'none';
    });

    confirm.addEventListener('click', () => {
        modal.style.display = 'none';
        trigger.classList.add('sent');
        trigger.innerHTML = '<span>SENT</span>';
        if (statusEl) statusEl.textContent = "SOS BROADCASTING";
        
        // Mock SOS API Call
        console.log("POSTING SOS SIGNAL...");
        console.log({
            user_id: "demo_user",
            location: userLocation,
            timestamp: new Date().toISOString(),
            disaster_type: "general"
        });

        // Add special effect to map
        if (map && userLocation) {
            map.flyTo({
                center: [userLocation.lng, userLocation.lat],
                zoom: 18,
                pitch: 80,
                bearing: 90,
                duration: 4000
            });
        }
    });

    // Close modal on escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') modal.style.display = 'none';
    });
}

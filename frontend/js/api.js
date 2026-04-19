/**
 * frontend/js/api.js
 * ==================
 * Central API configuration for the CrisisConnect ML Backend.
 * All frontend pages should import this file before making any API calls.
 *
 * Backend runs on: http://127.0.0.1:5001 (local dev)
 * Change BASE_URL below if deploying to a remote server.
 */

const CRISIS_API = {
    // Automatically switch between local development and production API
    BASE_URL: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://127.0.0.1:5001'
        : 'BACKEND_URL_PLACEHOLDER',

    endpoints: {
        health:       '/health',
        modelHealth:  '/health/models',
        predict:      '/predict',
        predictFull:  '/predict-full',
        predictDrift: '/predict-drift',
        predictSpots: '/predict-hotspots',
        predictRoute: '/predict-route',
        predictRisk:  '/predict-risk',
        realtimeSnap: '/realtime/snapshot',
        realtimeDisp: '/realtime/displacement',
        realtimeDrift:'/realtime/drift',
        realtimeFull: '/realtime/full',
        realtimeStat: '/realtime/status',
        disasters:    '/disasters/',
    },

    /**
     * Internal helper to ensure payload follows the 11-key canonical schema.
     */
    _normalize(p) {
        return {
            severity_score: p.severity_score || p.conflict_intensity || 0,
            risk_index: p.risk_index || 5,
            population_density: p.population_density || p.population || 50000,
            infrastructure_index: p.infrastructure_index || p.infra_score || 0.6,
            lat: p.lat,
            lon: p.lon,
            wind_speed: p.wind_speed || 0,
            wind_dir: p.wind_dir || 0,
            current_speed: p.current_speed || 0,
            current_dir: p.current_dir || 0,
            time_hours: p.time_hours || 0,
            // Pass-through extras for specific models
            coordinates: p.coordinates,
            source: p.source || 0,
            target: p.target,
            displaced_people: p.displaced_people || 0,
            disaster_type: p.disaster_type || 'default',
            severity: p.severity || p.severity_score || 0
        };
    },

    /**
     * Make a POST request to an ML endpoint.
     */
    async post(endpoint, body) {
        const payload = this._normalize(body);
        const url = this.BASE_URL + endpoint;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({ message: res.statusText }));
            throw new Error(`[${res.status}] ${err.message || res.statusText}`);
        }
        return res.json();
    },

    /**
     * Make a GET request to a backend endpoint.
     * @param {string} endpoint - One of CRISIS_API.endpoints values
     * @returns {Promise<object>}
     */
    async get(endpoint) {
        const url = this.BASE_URL + endpoint;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`[${res.status}] ${res.statusText}`);
        return res.json();
    },

    /**
     * Run the full 5-model intelligence pipeline.
     * @param {object} p - Payload with severity_score, population_density, lat, lon, etc.
     */
    async runFullPipeline(p) {
        // Ensure canonical keys are mapped if coming from legacy forms
        const payload = {
            severity_score: p.severity_score || p.conflict_intensity || 0,
            risk_index: p.risk_index || 5,
            population_density: p.population_density || p.population || 50000,
            infrastructure_index: p.infrastructure_index || p.infra_score || 0.6,
            lat: p.lat,
            lon: p.lon,
            wind_speed: p.wind_speed || 0,
            wind_dir: p.wind_dir || 0,
            current_speed: p.current_speed || 0,
            current_dir: p.current_dir || 0,
            time_hours: p.time_hours || 0,
            // Extras
            coordinates: p.coordinates,
            source: p.source || 0,
            target: p.target || -1,
            displaced_people: p.displaced_people || 0,
            disaster_type: p.disaster_type || 'default',
            severity: p.severity || p.severity_score || 0
        };
        return this.post(this.endpoints.predictFull, payload);
    },

    /**
     * Make a GET request to an ML endpoint.
     */
    async get(endpoint) {
        try {
            const url = endpoint.startsWith('http') ? endpoint : `${this.BASE_URL}${endpoint}`;
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json();
        } catch (err) {
            console.error('API Error (GET):', err);
            throw err;
        }
    },

    /**
     * Fetch the master list of disasters from the backend database.
     */
    async getDisasters() {
        return this.get(this.endpoints.disasters);
    },

    /**
     * Fetch specific disaster metadata.
     */
    async getDisasterById(id) {
        return this.get(`${this.endpoints.disasters}${id}`);
    },

    /**
     * Check if the backend is reachable.
     */
    async isAvailable() {
        try {
            const data = await this.get(this.endpoints.health);
            return data.status === 'ok';
        } catch {
            return false;
        }
    },
};

// Freeze so it can't be accidentally modified at runtime
Object.freeze(CRISIS_API);
Object.freeze(CRISIS_API.endpoints);

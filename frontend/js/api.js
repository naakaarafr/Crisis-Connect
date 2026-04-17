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
    BASE_URL: 'http://127.0.0.1:5001',

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
    },

    /**
     * Make a POST request to an ML endpoint.
     * @param {string} endpoint - One of CRISIS_API.endpoints values
     * @param {object} body - JSON payload
     * @returns {Promise<object>} - Parsed JSON response
     */
    async post(endpoint, body) {
        const url = this.BASE_URL + endpoint;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
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
     * @param {object} params
     */
    async runFullPipeline(params) {
        return this.post(this.endpoints.predictFull, params);
    },

    /**
     * Check if the backend is reachable.
     * @returns {Promise<boolean>}
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

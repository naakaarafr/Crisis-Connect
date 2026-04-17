/**
 * CrisisConnect Login Logic
 * Handles background animation, demo access, and authentication.
 */

/* ─── Animated Map Background ─── */
(function() {
    const mapContainer = document.getElementById('map-bg');
    if (!mapContainer) return;

    const map = L.map('map-bg', {
        zoomControl: false,
        attributionControl: false,
        dragging: false,
        touchZoom: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        boxZoom: false
    }).setView([20, 20], 3);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19
    }).addTo(map);

    // Adding some tactical grid lines over the map via CSS or simple overlay can work, 
    // but for now, let's keep it clean with a slow pan.
    let lat = 20, lng = 20;
    setInterval(() => {
        lng += 0.02;
        map.panTo([lat, lng], { animate: false });
    }, 100);
})();

/* ─── UI Interactions ─── */
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const loginBtn = document.getElementById('btn-login');
    const emailInput = document.getElementById('email-input');
    const pwInput = document.getElementById('pw-input');
    const pwToggle = document.getElementById('pw-toggle');
    const eyeIcon = document.getElementById('eye-icon');
    const rememberInput = document.getElementById('remember-input');

    const EYE_SHOW = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
    const EYE_HIDE = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>';

    // Clock
    function updateClock() {
        const d = new Date();
        const p = n => n.toString().padStart(2, '0');
        const clockEl = document.getElementById('timestamp');
        if (clockEl) {
            clockEl.textContent = `${d.getUTCFullYear()}-${p(d.getUTCMonth()+1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())} UTC`;
        }
    }
    setInterval(updateClock, 1000);
    updateClock();

    // Incident Counter
    let inc = 7;
    setInterval(() => {
        const incidentEl = document.getElementById('active-incidents');
        if (incidentEl && Math.random() < 0.3) {
            inc = Math.max(5, Math.min(12, inc + (Math.random() < 0.5 ? 1 : -1)));
            incidentEl.textContent = inc + ' ACTIVE INCIDENTS';
        }
    }, 4000);

    // Password Toggle
    if (pwToggle) {
        pwToggle.addEventListener('click', () => {
            const isText = pwInput.type === 'text';
            pwInput.type = isText ? 'password' : 'text';
            eyeIcon.innerHTML = isText ? EYE_SHOW : EYE_HIDE;
        });
    }

    // Demo Access
    const demoBtn = document.getElementById('btn-demo');
    if (demoBtn) {
        demoBtn.addEventListener('click', () => {
            emailInput.value = 'demo@crisisconnect.io';
            pwInput.value = 'crisis2024';
            [emailInput, pwInput].forEach(el => {
                el.style.borderColor = 'var(--amber)';
                el.style.boxShadow = '0 0 0 2px rgba(255,179,64,0.2)';
                setTimeout(() => { el.style.borderColor = ''; el.style.boxShadow = ''; }, 800);
            });
            hideError();
        });
    }

    // Form Submit
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = emailInput.value.trim();
            const password = pwInput.value;
            const remember = rememberInput.checked;

            if (!email || !password) {
                showError('AUTHENTICATION FAILED — All fields are required.');
                return;
            }

            loginBtn.disabled = true;
            loginBtn.classList.add('loading');
            hideError();

            try {
                let success = false;
                let token = null;

                // Attempt API call
                try {
                    const res = await fetch('/auth/login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email, password }),
                        signal: AbortSignal.timeout(3000)
                    });
                    
                    if (res.ok) {
                        const data = await res.json();
                        token = data.token;
                        success = true;
                    }
                } catch (fetchErr) {
                    console.warn("Network error or timeout - falling back to demo mode if applicable.");
                }

                // Global Fallback for Demo Credentials (Useful for static previews or offline mode)
                if (!success && email === 'demo@crisisconnect.io' && password === 'crisis2024') {
                    token = 'demo-jwt-' + Date.now();
                    success = true;
                    console.log("Demo credentials authenticated via client-side fallback.");
                }

                if (success && token) {
                    const storage = remember ? localStorage : sessionStorage;
                    storage.setItem('cc_token', token);
                    storage.setItem('cc_user', email);
                    showSuccess();
                    setTimeout(() => window.location.href = 'dashboard.html?v=2.0', 1400);
                } else {
                    showError('AUTHENTICATION FAILED — Invalid credentials. Try DEMO ACCESS.');
                }
            } catch (err) {
                showError('SYSTEM ERROR — Unable to reach security gateway.');
            } finally {
                loginBtn.disabled = false;
                loginBtn.classList.remove('loading');
            }
        });
    }
});

function showError(msg) {
    const banner = document.getElementById('error-banner');
    const msgEl = document.getElementById('error-msg');
    if (banner && msgEl) {
        msgEl.textContent = msg;
        banner.classList.add('show');
        const successBanner = document.getElementById('success-banner');
        if (successBanner) successBanner.classList.remove('show');
    }
}

function hideError() {
    const banner = document.getElementById('error-banner');
    if (banner) banner.classList.remove('show');
}

function showSuccess() {
    const banner = document.getElementById('success-banner');
    if (banner) {
        banner.classList.add('show');
        hideError();
    }
}

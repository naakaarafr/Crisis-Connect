/**
 * CrisisConnect Auth & Navigation Logic
 * Centralized authentication guard and common UI behaviors.
 */

// 1. Auth Guard: Check for token on load
(function() {
    const isLoginPage = window.location.pathname.endsWith('login.html');
    const isLandingPage = window.location.pathname.endsWith('index.html') || window.location.pathname === '/' || window.location.pathname.endsWith('/');
    const token = localStorage.getItem('cc_token') || sessionStorage.getItem('cc_token');

    if (!token && !isLoginPage && !isLandingPage) {
        window.location.replace('login.html?v=2.0');
    }
})();

// 2. Global UI Initialization
document.addEventListener('DOMContentLoaded', () => {
    // Sync User Identity in Navbar
    const user = localStorage.getItem('cc_user') || sessionStorage.getItem('cc_user');
    const userDisplay = document.getElementById('nav-user');
    if (userDisplay && user) {
        userDisplay.textContent = user.split('@')[0].toUpperCase();
    }

    // Initialize Status Bar Clock if present
    const clockEl = document.getElementById('status-clock');
    if (clockEl) {
        setInterval(() => {
            const now = new Date();
            clockEl.textContent = now.toLocaleTimeString([], { hour12: false });
        }, 1000);
    }
});

/**
 * Global Logout Function
 */
function ccLogout() {
    localStorage.removeItem('cc_token');
    localStorage.removeItem('cc_user');
    sessionStorage.removeItem('cc_token');
    sessionStorage.removeItem('cc_user');
    window.location.replace('login.html?v=2.0');
}

/**
 * Navigation Helper
 */
function navigateTo(page) {
    window.location.href = page;
}

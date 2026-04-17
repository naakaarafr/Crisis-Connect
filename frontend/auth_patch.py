import re

FILES = [
    'index.html',
    'disaster.html',
    'displacement.html',
    'resources.html',
    'secondary-risk.html',
    'simulate.html',
    'analytics.html',
    'alerts.html',
    'emergency.html',
]

# ── Auth guard: injected just before </head> ──
AUTH_GUARD = """  <script>
    (function() {
      var token = localStorage.getItem('cc_token') || sessionStorage.getItem('cc_token');
      if (!token) { window.location.replace('login.html?v=2.0'); }
    })();
  </script>"""

# ── Logout button: appended inside .nav-right ──
# We look for the bell-icon div and insert logout after nav-right closes
# Strategy: insert right before </nav>
LOGOUT_BTN = """    <div class="nav-right-extra" style="display:flex;align-items:center;gap:16px;margin-left:8px;">
      <span class="mono" id="nav-user" style="font-size:11px;color:var(--muted);letter-spacing:1px;text-transform:uppercase;"></span>
      <button onclick="ccLogout()" style="background:transparent;border:1px solid var(--border);color:var(--muted);font-family:'Rajdhani',sans-serif;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:5px 12px;border-radius:4px;cursor:pointer;transition:all 0.2s;" onmouseover="this.style.borderColor='var(--red)';this.style.color='var(--red)';" onmouseout="this.style.borderColor='var(--border)';this.style.color='var(--muted)';">⏏ LOGOUT</button>
    </div>"""

AUTH_LOGIC = """
    <script>
      /* ── Auth helpers ── */
      function ccLogout() {
        localStorage.removeItem('cc_token');
        localStorage.removeItem('cc_user');
        sessionStorage.removeItem('cc_token');
        sessionStorage.removeItem('cc_user');
        window.location.replace('login.html?v=2.0');
      }
      (function() {
        var user = localStorage.getItem('cc_user') || sessionStorage.getItem('cc_user') || '';
        var el = document.getElementById('nav-user');
        if (el && user) el.textContent = user.split('@')[0].toUpperCase();
      })();
    </script>"""

for fname in FILES:
    try:
        with open(fname, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        print(f'ERROR reading {fname}: {e}')
        continue

    changed = False

    # 1. Inject auth guard before </head> (only if not already present)
    if 'cc_token' not in content:
        content = content.replace('</head>', AUTH_GUARD + '\n</head>', 1)
        changed = True

    # 2. Inject logout button right before </nav> (only first nav occurrence)
    if 'ccLogout' not in content:
        # Insert logout button before closing </nav>
        content = content.replace('</nav>', LOGOUT_BTN + '\n  </nav>', 1)
        # Inject auth logic before </body>
        content = content.replace('</body>', AUTH_LOGIC + '\n</body>', 1)
        changed = True

    if changed:
        with open(fname, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f'Updated: {fname}')
    else:
        print(f'Skipped (already patched): {fname}')

"""
CrisisConnect — Color + Logo Overhaul
New palette: crisis orange (#FF5500) replaces cyan, warm dark borders, muted warm tones.
New logo: seismograph globe SVG (replaces shield).
"""
import os

FILES = [
    'index.html', 'disaster.html', 'displacement.html',
    'resources.html', 'secondary-risk.html', 'simulate.html',
    'analytics.html', 'alerts.html', 'login.html'
]

# ── Exact string replacements (order matters) ──
REPLACEMENTS = [
    # 1. CSS variable: primary accent
    ('--cyan: #00d4ff;',        '--cyan: #FF5500;'),
    ('--cyan: #00d4ff',         '--cyan: #FF5500'),

    # 2. CSS variable: border (warm dark instead of cold navy)
    ('--border: #1e2d5a;',      '--border: #2B1B10;'),
    ('--border: #1e2d5a',       '--border: #2B1B10'),

    # 3. CSS variable: muted (warm taupe instead of periwinkle)
    ('--muted: #7986cb;',       '--muted: #A08870;'),
    ('--muted: #7986cb',        '--muted: #A08870'),

    # 4. CSS variable: bg2 (slightly warmer dark)
    ('--bg2: #0f1629;',         '--bg2: #110D0A;'),
    ('--bg2: #0f1629',          '--bg2: #110D0A'),

    # 5. CSS variable: card
    ('--card: #141c33;',        '--card: #1A1008;'),
    ('--card: #141c33',         '--card: #1A1008'),

    # 6. Hex color direct refs
    ('#00d4ff',                  '#FF5500'),
    ('#33ddff',                  '#FF7733'),

    # 7. rgba(0, 212, 255, ...) — all common opacities in HTML/CSS
    ('rgba(0, 212, 255, 0.3)',   'rgba(255, 85, 0, 0.3)'),
    ('rgba(0, 212, 255, 0.25)',  'rgba(255, 85, 0, 0.25)'),
    ('rgba(0, 212, 255, 0.2)',   'rgba(255, 85, 0, 0.2)'),
    ('rgba(0, 212, 255, 0.15)',  'rgba(255, 85, 0, 0.15)'),
    ('rgba(0, 212, 255, 0.12)',  'rgba(255, 85, 0, 0.12)'),
    ('rgba(0, 212, 255, 0.10)',  'rgba(255, 85, 0, 0.10)'),
    ('rgba(0, 212, 255, 0.1)',   'rgba(255, 85, 0, 0.1)'),
    ('rgba(0, 212, 255, 0.08)',  'rgba(255, 85, 0, 0.08)'),
    ('rgba(0, 212, 255, 0.06)',  'rgba(255, 85, 0, 0.06)'),
    ('rgba(0, 212, 255, 0.05)',  'rgba(255, 85, 0, 0.05)'),
    ('rgba(0, 212, 255, 0.04)',  'rgba(255, 85, 0, 0.04)'),
    ('rgba(0, 212, 255, 0.012)','rgba(255, 85, 0, 0.012)'),
    ('rgba(0, 212, 255, 0.4)',   'rgba(255, 85, 0, 0.4)'),
    ('rgba(0, 212, 255, 0.5)',   'rgba(255, 85, 0, 0.5)'),
    ('rgba(0,212,255,',          'rgba(255,85,0,'),
    # catch any remaining style with 0,212,255
    ('0, 212, 255',              '255, 85, 0'),

    # 8. Background card colors using old card/bg2 in rgba form
    ('rgba(20, 28, 51,',         'rgba(22, 12, 6,'),
    ('rgba(15, 22, 41,',         'rgba(14, 9, 5,'),
    ('rgba(30, 45, 90,',         'rgba(43, 27, 16,'),

    # 9. OLD LOGO SVG path (shield) → NEW seismograph-globe path
    # The shield path appears in nav svgs and login card logo
    (
        '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
        '<circle cx="12" cy="12" r="10"/><polyline points="2,12 5,12 6.5,8 8,15 9.5,9 11,14 12,12 14,12 22,12"/>'
    ),

    # 10. Sidebar/panel bg old colors
    ('rgba(10, 14, 26, 0.9)',    'rgba(10, 6, 3, 0.9)'),
    ('rgba(10, 14, 26, 0.95)',   'rgba(10, 6, 3, 0.95)'),
    ('rgba(10, 14, 26, 0.8)',    'rgba(10, 6, 3, 0.8)'),
    ('rgba(10, 14, 26, 0.5)',    'rgba(10, 6, 3, 0.5)'),
    ('rgba(10,14,26,',           'rgba(10,6,3,'),

    # 11. Login card canvas particle color string in JS
    ("'rgba(0, 212, 255,",       "'rgba(255, 85, 0,"),
    ('"rgba(0, 212, 255,',       '"rgba(255, 85, 0,'),
    (
        "ctx.strokeStyle = `rgba(0, 212, 255, ${0.06 * (1 - dist / 120)})`",
        "ctx.strokeStyle = `rgba(255, 85, 0, ${0.06 * (1 - dist / 120)})`"
    ),
    # grid dot fill in login canvas
    ("'rgba(0, 212, 255, 0.1)'", "'rgba(255, 85, 0, 0.1)'"),
    ("'rgba(0, 212, 255, 0.12)'","'rgba(255, 85, 0, 0.12)'"),
    # lat/lng grid lines
    (
        "? 'rgba(0, 212, 255, 0.12)'",
        "? 'rgba(255, 85, 0, 0.12)'"
    ),

    # 12. placeholder text color
    ('rgba(121, 134, 203,',      'rgba(160, 136, 112,'),

    # 13. card-footer color
    ('rgba(121, 134, 203, 0.5)', 'rgba(160, 136, 112, 0.5)'),
]

# ── Also update the nav-brand SVG wrapper stroke-width to 1.5 for the seismograph icon ──
LOGO_SVG_OLD = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">\n        <circle cx="12" cy="12" r="10"/><polyline points="2,12 5,12 6.5,8 8,15 9.5,9 11,14 12,12 14,12 22,12"/>'
LOGO_SVG_NEW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">\n        <circle cx="12" cy="12" r="10"/><polyline points="2,12 5,12 6.5,8 8,15 9.5,9 11,14 12,12 14,12 22,12"/>'

for fname in FILES:
    if not os.path.exists(fname):
        print(f'MISSING: {fname}')
        continue

    with open(fname, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content
    for old, new in REPLACEMENTS:
        content = content.replace(old, new)

    # Fix SVG stroke-width for the new icon (navbar context)
    content = content.replace(LOGO_SVG_OLD, LOGO_SVG_NEW)

    if content != original:
        with open(fname, 'w', encoding='utf-8') as f:
            f.write(content)
        changes = sum(1 for o, n in REPLACEMENTS if o in original)
        print(f'Updated [{changes} patterns]: {fname}')
    else:
        print(f'No changes: {fname}')

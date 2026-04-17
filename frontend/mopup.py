"""
CrisisConnect — Mop-up remaining old color refs missed in rebrand.py
"""
import os

FILES = [
    'index.html', 'disaster.html', 'displacement.html',
    'resources.html', 'secondary-risk.html', 'simulate.html',
    'analytics.html', 'alerts.html', 'login.html'
]

REPLACEMENTS = [
    # Search-input SVG icon (URL-encoded hex in inline SVG)
    ('%237986cb',        '%23A08870'),   # %23 = # in URL encoding

    # Chart.js default color
    ("'#7986cb'",        "'#A08870'"),
    ('"#7986cb"',        '"#A08870"'),
    ('= #7986cb',        '= #A08870'),

    # Hardcoded landslide/secondary type color
    ("'#7986cb'",        "'#A08870'"),
    ('#7986cb',          '#A08870'),

    # analytics.html grid line + tooltip border color refs
    ("'#1e2d5a'",        "'#2B1B10'"),
    ('"#1e2d5a"',        '"#2B1B10"'),
    ('#1e2d5a',          '#2B1B10'),
]

for fname in FILES:
    if not os.path.exists(fname):
        print(f'MISSING: {fname}')
        continue

    with open(fname, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content
    for old, new in REPLACEMENTS:
        content = content.replace(old, new)

    if content != original:
        with open(fname, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f'Cleaned: {fname}')
    else:
        print(f'Already clean: {fname}')

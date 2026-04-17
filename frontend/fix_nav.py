import re

# Map: filename -> index of the active button (0-indexed)
PAGES = {
    'index.html': 0,
    'disaster.html': 1,
    'displacement.html': 2,
    'resources.html': 3,
    'secondary-risk.html': 4,
    'simulate.html': 5,
    'analytics.html': 6,
    'alerts.html': 7,
    'emergency.html': 8,
}

LINKS = [
    ('index.html', 'Dashboard',
     '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="9"></rect><rect x="14" y="3" width="7" height="5"></rect><rect x="14" y="12" width="7" height="9"></rect><rect x="3" y="16" width="7" height="5"></rect></svg>'),
    ('disaster.html', 'Disasters',
     '<svg viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>'),
    ('displacement.html', 'Displacement',
     '<svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>'),
    ('resources.html', 'Resources',
     '<svg viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>'),
    ('secondary-risk.html', 'Risk',
     '<svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>'),
    ('simulate.html', 'Simulate',
     '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polygon points="10 8 16 12 10 16 10 8"></polygon></svg>'),
    ('analytics.html', 'Analytics',
     '<svg viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>'),
    ('alerts.html', 'Alerts',
     '<svg viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>'),
    ('emergency.html', 'Emergency',
     '<svg viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path></svg>'),
]


def build_sidebar(active_idx):
    lines = ['<aside class="sidebar">']
    for i, (href, title, svg) in enumerate(LINKS):
        active_class = ' active' if i == active_idx else ''
        # Last item gets push-to-bottom style
        style = ' style="margin-top:auto; margin-bottom: 10px;"' if i == len(LINKS) - 1 else ''
        lines.append(f'      <a href="{href}" class="sidebar-btn{active_class}" title="{title}"{style}>')
        lines.append(f'        {svg}')
        lines.append('      </a>')
    lines.append('    </aside>')
    return '\n'.join(lines)

for filename, active_idx in PAGES.items():
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        print(f'ERROR reading {filename}: {e}')
        continue

    new_sidebar = build_sidebar(active_idx)

    # Replace the entire <aside class="sidebar">...</aside> block (handles CRLF too)
    new_content = re.sub(
        r'<aside class="sidebar">[\s\S]*?</aside>',
        new_sidebar,
        content
    )

    if new_content == content:
        print(f'WARNING: No sidebar found in {filename}')
    else:
        with open(filename, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f'Fixed: {filename}')

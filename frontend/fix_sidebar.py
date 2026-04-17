import os
import re

files = [
    'disaster.html',
    'displacement.html',
    'resources.html',
    'secondary-risk.html',
    'simulate.html',
    'analytics.html'
]

sidebar_template = """<aside class="sidebar">
      <a href="index.html" class="sidebar-btn{0}" title="Dashboard">
        <svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="9"></rect><rect x="14" y="3" width="7" height="5"></rect><rect x="14" y="12" width="7" height="9"></rect><rect x="3" y="16" width="7" height="5"></rect></svg>
      </a>
      <a href="disaster.html" class="sidebar-btn{1}" title="Disasters">
        <svg viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
      </a>
      <a href="displacement.html" class="sidebar-btn{2}" title="Displacement">
        <svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
      </a>
      <a href="resources.html" class="sidebar-btn{3}" title="Resources">
        <svg viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
      </a>
      <a href="secondary-risk.html" class="sidebar-btn{4}" title="Risk">
        <svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
      </a>
      <a href="simulate.html" class="sidebar-btn{5}" title="Simulate">
        <svg viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
      </a>
      <a href="analytics.html" class="sidebar-btn{6}" title="Analytics">
        <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
      </a>
      <a href="alerts.html" class="sidebar-btn{7}" title="Alerts" style="margin-top:auto; margin-bottom: 10px;">
        <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
      </a>
    </aside>"""

active_map = {
    'index.html': 0,
    'disaster.html': 1,
    'displacement.html': 2,
    'resources.html': 3,
    'secondary-risk.html': 4,
    'simulate.html': 5,
    'analytics.html': 6,
    'alerts.html': 7
}

for fpath in files:
    with open(fpath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    filename = os.path.basename(fpath)
    active_idx = active_map[filename]
    
    classes = [''] * 8
    classes[active_idx] = ' active'
    
    replacement = sidebar_template.format(*classes)
    
    new_content = re.sub(r'<aside class="sidebar">[\s\S]*?<\/aside>', replacement, content)
    
    with open(fpath, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print(f'Updated {filename}')

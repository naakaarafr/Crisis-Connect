import os
import re

VERSION = "?v=2.0" # Cache BUSTER
FILES = []

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    new_content = content
    
    # regex pattern to match relative/local links to our specific file types ending in .html, .css, .js
    # it looks for href="..." or src="..." or window.location.replace('...') etc.
    # Group 1: The prefix like href=" or src=" or '
    # Group 2: The path without query params, e.g., css/base.css
    # We want to ignore paths starting with http://, https://, or //
    
    # 1. Clean existing ?v=... to avoid ?v=1.1?v=2.0
    new_content = re.sub(r'((?:href|src)=["\'](?!https?://|//)[^"\'\?]+?\.(?:html|css|js))\?v=[^"\']+', r'\1', new_content)
    
    # For inline javascript window.location strings like 'dashboard.html?v=3'
    new_content = re.sub(r'([\'"](?:(?!https?://|//)[^"\'\?]+?\.(?:html|css|js)))\?v=[^"\']+', r'\1', new_content)

    # 2. Append the new version
    # Match href="local.css", src="local.js", href="local.html"
    def add_version(match):
        prefix = match.group(1)
        path = match.group(2)
        # Verify it doesn't already have ?
        if '?' in path:
            return match.group(0)
        return f"{prefix}{path}{VERSION}{match.group(3)}"
        
    pattern = r'((?:href|src)=["\'])((?!https?://|//)[^"\'\?]+?\.(?:html|css|js))(["\'])'
    new_content = re.sub(pattern, add_version, new_content)
    
    # Match javascript string literal links like 'dashboard.html'
    # Wait, the previous pattern caught href="dashboard.html". This one is for 'dashboard.html'
    pattern_js = r'([\'"])((?!https?://|//)[^"\'\?]+?\.(?:html|css|js))([\'"])'
    
    # We need to only match window.location.href='...' or simple 'file.html' but we might match some random strings too.
    # Fortunately the previous regex didn't break things unless they looked like a path.
    # Let's apply it.
    def add_version_js(match):
        quote1 = match.group(1)
        path = match.group(2)
        quote2 = match.group(3)
        # Skip if within a tag attribute because we already processed href/src
        if "?" in path: return match.group(0)
        return f"{quote1}{path}{VERSION}{quote2}"

    # Careful, we only want to match exactly strings ending in .html, .css, .js
    # But only inside JS context or fallback?
    # Let's just do it.
    new_content = re.sub(pattern_js, add_version_js, new_content)

    if content != new_content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Updated: {filepath}")

for root, _, files in os.walk('.'):
    # ignore .git, node_modules etc
    if '.git' in root or 'node_modules' in root:
        continue
    for file in files:
        if file.endswith(('.html', '.js')):
            filepath = os.path.join(root, file)
            process_file(filepath)

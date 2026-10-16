#!/usr/bin/env python3
"""Stamps every local script and stylesheet reference with a version: i18n.js -> i18n.js?v=3f2a1c9e.

Browsers keep the site's files for hours (Cloudflare's browser cache), so after a deploy a new page
could run with an old script, and a missing export stops the whole page. With the version in the
address, a changed file is a new address and a page always loads the files it was made with. The
version is a hash of all the scripts and stylesheets, so it changes whenever any of them does.

Run before each commit that touches src/, the pages or the CSS:  python3 tools/stamp.py
"""
import hashlib, pathlib, re, subprocess

ROOT = pathlib.Path(__file__).resolve().parent.parent
files = [ROOT / f for f in subprocess.run(['git', 'ls-files', '*.html', '*.js', '*.css'], cwd=ROOT,
         capture_output=True, text=True, check=True).stdout.split()]
files = [f for f in files if not f.relative_to(ROOT).parts[0] in ('supabase', 'cloudflare') and f.exists()]

# A reference to a local .js or .css file, with or without a version already.
REF = re.compile(r"""((?:from\s+|import\(\s*|src=|href=)(['"])(?!https?:|//)[^'"?]+\.(?:js|css))(?:\?v=[0-9a-f]+)?(\2)""")

def unstamped(text):
    return REF.sub(r'\1\3', text)

# The version: a hash of the scripts and stylesheets as they would be without versions.
h = hashlib.sha256()
for f in sorted(files):
    if f.suffix in ('.js', '.css'):
        h.update(unstamped(f.read_text()).encode())
version = h.hexdigest()[:8]

changed = 0
for f in files:
    text = f.read_text()
    new = REF.sub(lambda m: f'{m.group(1)}?v={version}{m.group(3)}', text)
    if new != text:
        f.write_text(new)
        changed += 1
print(f'version {version}: {changed} files stamped')

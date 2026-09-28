#!/usr/bin/env node
/** Copy web assets into www/ for Capacitor + docs/ + dist zip */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.join(__dirname, '..');

function rmrf(p) {
  if (!fs.existsSync(p)) return;
  for (const e of fs.readdirSync(p)) {
    const cur = path.join(p, e);
    if (fs.lstatSync(cur).isDirectory()) rmrf(cur);
    else fs.unlinkSync(cur);
  }
  fs.rmdirSync(p);
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const e of fs.readdirSync(src)) {
    const s = path.join(src, e);
    const d = path.join(dest, e);
    if (fs.lstatSync(s).isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function copyWeb(dest) {
  rmrf(dest);
  fs.mkdirSync(dest, { recursive: true });
  const files = ['index.html', 'privacy.html', 'manifest.webmanifest', 'sw.js', 'css', 'js', 'icons'];
  for (const f of files) {
    const s = path.join(root, f);
    const d = path.join(dest, f);
    if (!fs.existsSync(s)) continue;
    if (fs.lstatSync(s).isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

copyWeb(path.join(root, 'www'));
console.log('Built www/');

// docs: full web + README/STATUS
copyWeb(path.join(root, 'docs'));
for (const f of ['README.md', 'STATUS.md']) {
  const s = path.join(root, f);
  if (fs.existsSync(s)) fs.copyFileSync(s, path.join(root, 'docs', f));
}
console.log('Built docs/');

// dist folder for Windows zip
const distWeb = path.join(root, 'dist', 'car-jam-solver-web');
copyWeb(distWeb);
for (const f of ['README.md', 'STATUS.md']) {
  const s = path.join(root, f);
  if (fs.existsSync(s)) fs.copyFileSync(s, path.join(distWeb, f));
}

fs.writeFileSync(path.join(distWeb, 'PLAY-WINDOWS.bat'),
`@echo off
cd /d "%~dp0"
echo Starting Car Jam Solver...
echo Open http://localhost:4180 in your browser
where py >nul 2>nul && (start http://localhost:4180 & py -m http.server 4180 & goto :eof)
where python >nul 2>nul && (start http://localhost:4180 & python -m http.server 4180 & goto :eof)
where python3 >nul 2>nul && (start http://localhost:4180 & python3 -m http.server 4180 & goto :eof)
echo No Python found. Open index.html directly in a browser (file://).
start index.html
`);

fs.writeFileSync(path.join(distWeb, 'PLAY.sh'),
`#!/usr/bin/env bash
cd "$(dirname "$0")"
echo "Car Jam Solver → http://localhost:4180"
(command -v python3 >/dev/null && python3 -m http.server 4180) || (command -v python >/dev/null && python -m http.server 4180)
`);
try { fs.chmodSync(path.join(distWeb, 'PLAY.sh'), 0o755); } catch (_) {}

const zipPath = path.join(root, 'dist', 'car-jam-solver-web-windows.zip');
try { fs.unlinkSync(zipPath); } catch (_) {}
try {
  execSync(`cd "${path.join(root, 'dist')}" && zip -r -q car-jam-solver-web-windows.zip car-jam-solver-web`, { stdio: 'inherit' });
} catch (_) {
  execSync(`python3 - <<'PY'
import os, zipfile
root = r"${root}"
src = os.path.join(root, "dist", "car-jam-solver-web")
out = os.path.join(root, "dist", "car-jam-solver-web-windows.zip")
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
    for dirpath, _, files in os.walk(src):
        for f in files:
            full = os.path.join(dirpath, f)
            arc = os.path.relpath(full, os.path.join(root, "dist"))
            z.write(full, arc)
print("python zip ok", os.path.getsize(out))
PY`, { stdio: 'inherit' });
}
fs.copyFileSync(zipPath, path.join(root, 'docs', 'car-jam-solver-web-windows.zip'));
console.log('Built dist/car-jam-solver-web-windows.zip');

#!/usr/bin/env python3
# NAME
#   sync-apptest.py — 宙の辻ローカルテストハーネス(apptest)の構築・同期
# SYNOPSIS
#   python3 tests/harness/sync-apptest.py <apptestディレクトリ>
# DESCRIPTION
#   リポジトリのアプリ一式を<apptestディレクトリ>へコピーし、index.htmlと各ワーカーの
#   CDN参照をローカルのvendor/パスへ書き換える。verify96〜のローカル検証(実ネットワーク遮断)は
#   このディレクトリをHTTPサーバで配信して行う。何度でも再実行できる(変更ファイルの再同期)。
#   vendor/の中身が無い場合は、入手コマンド(curl)を表示して案内する。
# HISTORY
#   第22ラウンドでセッション作業領域に生まれ、第41ラウンドでリポジトリへ昇格
#   (セッション初期化でハーネス構築の知識が消える問題への対処。スキル kaiki から使う)。
# SEE ALSO
#   .claude/skills/kaiki/SKILL.md(回帰の回し方)・tests/README.md(各verifyの内容)
import re, sys, os, shutil

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
if len(sys.argv) < 2:
    print(__doc__ or 'usage: sync-apptest.py <apptest-dir>')
    print('usage: python3 tests/harness/sync-apptest.py <apptestディレクトリ>')
    sys.exit(1)
APP = os.path.abspath(sys.argv[1])
os.makedirs(APP, exist_ok=True)

# アプリの配信面(テストが読み込むファイル)。docs/tests/reviews等の開発文書は含めない
FILES = [
    'index.html', 'script.js', 'style.css', 'forecast-features.html', 'reset.html',
    'dp-line-worker.js', 'sora-mov-worker.js', 'sora-terrain-worker.js',
    'tm-vis-worker.js', 'tsuji-search-worker.js', 'tsujimesh-search-worker.js',
    'celestial_db.json', 'constellations.borders.json', 'constellations.lines.json',
    'constellation_bounds_skymap_4k_print.webp', 'constellation_figures_skymap_4k_print.webp',
    'milkyway-skymap.webp', 'milkyway-skymap_4k.webp', 'milkyway-skymap_print.webp',
    'muni.js', 'muni.json', 'logo.png', 'favicon.ico', 'apple-touch-icon.png',
]
DIRS = ['fonts', 'data']

for f in FILES:
    src = os.path.join(REPO, f)
    if os.path.exists(src):
        shutil.copy(src, os.path.join(APP, f))
for d in DIRS:
    src = os.path.join(REPO, d)
    if os.path.isdir(src):
        shutil.copytree(src, os.path.join(APP, d), dirs_exist_ok=True)

# CDN参照→vendor/ の書き換え(index.html)。パターンは現行index.htmlの参照と一致させて保守する
SUBS = [
    (r"https://geographiclib\.sourceforge\.io/scripts/geographiclib-geodesic\.min\.js", "vendor/geographiclib-geodesic.min.js"),
    (r"https://geographiclib\.sourceforge\.io/scripts/geographiclib-dms\.min\.js", "vendor/geographiclib-dms.min.js"),
    (r"https://cdn\.jsdelivr\.net/npm/mathjax@3/es5/tex-mml-chtml\.js", "vendor/mathjax-stub.js"),
    (r"https://cdn\.jsdelivr\.net/npm/astronomy-engine@2\.1\.19/astronomy\.browser\.min\.js", "vendor/astronomy.browser.min.js"),
    (r"https://cdn\.jsdelivr\.net/npm/three@0\.160\.0/build/three\.min\.js", "vendor/three.min.js"),
    (r"https://unpkg\.com/maplibre-gl@4\.7\.1/dist/maplibre-gl\.css", "vendor/maplibre-gl.css"),
    (r"https://unpkg\.com/maplibre-gl@4\.7\.1/dist/maplibre-gl\.js", "vendor/maplibre-gl.js"),
    (r"https://cdn\.jsdelivr\.net/npm/qrcode-generator@1\.4\.4/qrcode\.min\.js", "vendor/qrcode.min.js"),
]
idx = os.path.join(APP, 'index.html')
s = open(idx, encoding='utf-8').read()
n = 0
for pat, rep in SUBS:
    s, c = re.subn(pat, rep, s)
    n += c
open(idx, 'w', encoding='utf-8').write(s)

# ワーカーのCDN参照(astronomy-engine)もvendorへ
wn = 0
for w in ['dp-line-worker.js', 'sora-mov-worker.js', 'tsuji-search-worker.js', 'tsujimesh-search-worker.js']:
    p = os.path.join(APP, w)
    if os.path.exists(p):
        t = open(p, encoding='utf-8').read()
        t, c = re.subn(r"https://cdn\.jsdelivr\.net/npm/astronomy-engine@2\.1\.19/astronomy\.browser\.min\.js",
                       "vendor/astronomy.browser.min.js", t)
        open(p, 'w', encoding='utf-8').write(t)
        wn += c

# script.jsのCDN参照(Dracoデコーダ=都市モードのPLATEAU建物レイヤ)もvendorへ
sp = os.path.join(APP, 'script.js')
if os.path.exists(sp):
    t = open(sp, encoding='utf-8').read()
    t, c = re.subn(r"https://cdn\.jsdelivr\.net/npm/three@0\.160\.0/examples/jsm/libs/draco/", "vendor/draco/", t)
    open(sp, 'w', encoding='utf-8').write(t)
    wn += c

# vendor/ の充足チェック(無ければ入手コマンドを案内。mathjax-stubはここで生成する)
VENDOR = os.path.join(APP, 'vendor')
os.makedirs(VENDOR, exist_ok=True)
stub = os.path.join(VENDOR, 'mathjax-stub.js')
if not os.path.exists(stub):
    open(stub, 'w', encoding='utf-8').write('// MathJax stub (ローカル検証用: 数式表示は検証対象外)\n')
NEED = {
    'maplibre-gl.js':  'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js',
    'maplibre-gl.css': 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css',
    'astronomy.browser.min.js': 'https://cdn.jsdelivr.net/npm/astronomy-engine@2.1.19/astronomy.browser.min.js',
    'three.min.js':    'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js',
    'geographiclib-geodesic.min.js': 'https://geographiclib.sourceforge.io/scripts/geographiclib-geodesic.min.js',
    'geographiclib-dms.min.js':      'https://geographiclib.sourceforge.io/scripts/geographiclib-dms.min.js',
    'qrcode.min.js': 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js',
    'draco/draco_wasm_wrapper.js': 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/draco/draco_wasm_wrapper.js',
    'draco/draco_decoder.wasm':    'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/draco/draco_decoder.wasm',
}
os.makedirs(os.path.join(VENDOR, 'draco'), exist_ok=True)
missing = [(f, u) for f, u in NEED.items() if not os.path.exists(os.path.join(VENDOR, f))]
print(f'synced (index.html {n}refs / workers {wn}refs rewritten) -> {APP}')
if missing:
    print('vendor/ に不足があります。以下で入手してください(プロキシ環境ではcurlがそのまま通ります):')
    for f, u in missing:
        print(f"  curl -sL -o '{VENDOR}/{f}' '{u}'")

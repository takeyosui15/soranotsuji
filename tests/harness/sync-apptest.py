#!/usr/bin/env python3
# NAME
#   sync-apptest.py — 宙の辻ローカルテストハーネス(apptest)の構築・同期
# SYNOPSIS
#   python3 tests/harness/sync-apptest.py <apptestディレクトリ>
# DESCRIPTION
#   リポジトリのアプリ一式(vendor/ を含む)を<apptestディレクトリ>へコピーし、vendor/ の中身が
#   MANIFEST.json の指紋と一致することを確かめる(第159から第三者ライブラリは自前配信)。verify96〜のローカル検証(実ネットワーク遮断)は
#   このディレクトリをHTTPサーバで配信して行う。何度でも再実行できる(変更ファイルの再同期)。
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
    'index.html', 'script.js', 'sora-constants.js', 'style.css', 'forecast-features.html', 'reset.html', 'reset.js', 'three-global.js',
    'privacy.html', 'terms.html',
    'dp-line-worker.js', 'sora-mov-worker.js', 'sora-terrain-worker.js',
    'tm-vis-worker.js', 'tsuji-search-worker.js', 'tsujimesh-search-worker.js', 'kashimap-worker.js',
    'celestial_db.json', 'constellations.borders.json', 'constellations.lines.json',
    'constellation_bounds_skymap_4k_print.webp', 'constellation_figures_skymap_4k_print.webp',
    'milkyway-skymap.webp', 'milkyway-skymap_4k.webp', 'milkyway-skymap_print.webp',
    'muni.js', 'muni.json', 'logo.png', 'favicon.ico', 'apple-touch-icon.png',
]
DIRS = ['fonts', 'data', 'vendor']   # vendor/ は第159からリポジトリ同梱(第三者ライブラリの自前配信)。指紋は MANIFEST.json と照合(下)。CDN→vendor の書き換えは不要になったので無い

for f in FILES:
    src = os.path.join(REPO, f)
    if os.path.exists(src):
        shutil.copy(src, os.path.join(APP, f))
for d in DIRS:
    src = os.path.join(REPO, d)
    if os.path.isdir(src):
        shutil.copytree(src, os.path.join(APP, d), dirs_exist_ok=True)

# vendor/ はリポジトリ同梱(第159)。コピーした中身が vendor/MANIFEST.json の指紋(sha256)と一致することを確かめる(違えば中断=検証対象のライブラリが本物であることの前提)
import json, hashlib
man = json.load(open(os.path.join(APP, 'vendor', 'MANIFEST.json'), encoding='utf-8'))
bad = []
for f in man['files']:
    p = os.path.join(APP, 'vendor', f['path'])
    if not os.path.exists(p):
        bad.append(f['path'] + ': 無い'); continue
    if hashlib.sha256(open(p, 'rb').read()).hexdigest() != f['sha256']:
        bad.append(f['path'] + ': 指紋が台帳と違う')
if bad:
    print('vendor/ の中身が台帳(MANIFEST.json)と合いません:'); [print('  ' + b) for b in bad]
    sys.exit(2)
print(f'synced -> {APP} (vendor {len(man["files"])} files verified against MANIFEST.json)')

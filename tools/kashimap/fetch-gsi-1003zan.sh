#!/bin/bash
# 地理院「日本の主な山岳標高(1003山)」CSVの取り直し(OpenSSL 3系の環境向け)。
# 証明書の検証は無効化しない。古い「安全でない再交渉」だけを許す設定を OPENSSL_CONF で渡す。
set -e
HERE=$(cd "$(dirname "$0")" && pwd)
CNF=$(mktemp)
cat > "$CNF" <<'CNF'
openssl_conf = openssl_init
[openssl_init]
ssl_conf = ssl_sect
[ssl_sect]
system_default = system_default_sect
[system_default_sect]
Options = UnsafeLegacyRenegotiation
CNF
PAGE="https://www.gsi.go.jp/kihonjohochousa/kihonjohochousa41139.html"
OPENSSL_CONF="$CNF" curl -sS -L -o "$HERE/src/gsi41139.html" "$PAGE"
# ページ内のCSVリンク(例: .../1003zan/1003zan20260331.csv)を拾って保存する
CSV=$(grep -o 'https://www.gsi.go.jp/[^"]*1003zan[^"]*\.csv' "$HERE/src/gsi41139.html" | head -1)
[ -z "$CSV" ] && CSV=$(grep -o '/[^"]*1003zan[^"]*\.csv' "$HERE/src/gsi41139.html" | head -1 | sed 's#^#https://www.gsi.go.jp#')
echo "CSV: $CSV"
OPENSSL_CONF="$CNF" curl -sS -L -o "$HERE/src/1003zan-latest.csv" "$CSV"
rm -f "$CNF" "$HERE/src/gsi41139.html"
ls -la "$HERE/src/1003zan-latest.csv"
echo "取得後、日付つきの名前に改名して build-meizan-map.py の SRC_GSI を差し替えてください"

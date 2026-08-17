#!/usr/bin/env python3
# -*- coding: utf-8 -*-

#
# 宙の辻 - Sora no Tsuji
# Copyright (C) 2026 Takeyoshi Watanabe (Sora no Tsuji Project)
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
"""
SIMBAD TAP API 動作確認テスト (HTTP直接方式)
pip install不要 — Python標準ライブラリのみ使用
"""

import json
import urllib.parse
import urllib.request

SIMBAD_TAP_URL = "https://simbad.cds.unistra.fr/simbad/sim-tap/sync"

query = "SELECT TOP 5 main_id, ra, dec FROM basic WHERE ra IS NOT NULL"

params = {
    "REQUEST": "doQuery",
    "LANG": "ADQL",
    "FORMAT": "json",
    "QUERY": query,
}
data = urllib.parse.urlencode(params).encode("utf-8")
req = urllib.request.Request(SIMBAD_TAP_URL, data=data)
req.add_header("User-Agent", "SoraNoTsuji/1.0 (test)")

print("SIMBAD TAP APIにクエリ送信中...")
with urllib.request.urlopen(req, timeout=30) as resp:
    result = json.loads(resp.read().decode("utf-8"))

columns = [col["name"] for col in result["metadata"]]
print(f"\nカラム: {columns}")
print(f"取得件数: {len(result['data'])}\n")

for row in result["data"]:
    print(f"  {row[0]:30s}  RA={row[1]:.6f}°  Dec={row[2]:.6f}°")

print("\n動作確認OK")

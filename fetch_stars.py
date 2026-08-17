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
SIMBAD天体データ取得スクリプト (HTTP直接方式)
==============================================
Python標準ライブラリのみ使用(pip install不要)

出力: celestial_db.json
用途: 宙の辻アプリの天体検索メニュー用データ

使い方:
  python3 fetch_stars.py
"""

import csv
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request

# ============================================================
# 定数
# ============================================================
SIMBAD_TAP_URL = "https://simbad.cds.unistra.fr/simbad/sim-tap/sync"
V_MAG_LIMIT = 6.0
DECIMAL_PLACES = 6
OUTPUT_FILE = "celestial_db.json"
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(SCRIPT_DIR, "data")

# レート制限対策: クエリ間の待機秒数
QUERY_INTERVAL = 3

# SIMBAD天体type略称 → 日本語名
OTYPE_JA = {
    "GlC": "球状星団", "OpC": "散開星団", "Cl*": "星団", "As*": "星群",
    "SNR": "超新星残骸", "PN": "惑星状星雲",
    "HII": "HII領域", "RNe": "反射星雲", "SFR": "星形成領域",
    "G": "銀河", "SBG": "棒渦巻銀河", "H2G": "渦巻銀河",
    "AGN": "活動銀河核", "Sy2": "セイファート銀河",
    "LIN": "LINER銀河", "SyG": "セイファート銀河",
    "GiC": "銀河群", "GiG": "銀河群", "GiP": "銀河ペア",
    "err": "誤認天体", "?": "未分類",
    "*": "恒星", "**": "連星", "SB*": "分光連星", "Em*": "輝線星",
    "V*": "変光星", "Psr": "パルサー", "WD*": "白色矮星",
}


# ============================================================
# CSVマッピング読み込み
# ============================================================

def load_constellation_ja():
    """星座略号 → 日本語名のマッピングを読み込み"""
    filepath = os.path.join(DATA_DIR, "constellation_ja.csv")
    mapping = {}
    with open(filepath, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            mapping[row["abbr"]] = row["name_ja"]
    return mapping


def load_greek_letters():
    """ギリシャ文字略号 → 記号のマッピングを読み込み"""
    filepath = os.path.join(DATA_DIR, "greek_letters.csv")
    mapping = {}
    with open(filepath, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            mapping[row["key"]] = row["letter"]
    return mapping


def load_star_names_ja():
    """主要恒星のmain_id → 日本語固有名のマッピングを読み込み"""
    filepath = os.path.join(DATA_DIR, "star_names_ja.csv")
    mapping = {}
    with open(filepath, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            mapping[row["main_id"]] = row["name_ja"]
    return mapping


def load_messier_names_ja():
    """メシエ天体のmessier_id → 日本語名のマッピングを読み込み"""
    filepath = os.path.join(DATA_DIR, "messier_names_ja.csv")
    mapping = {}
    with open(filepath, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            mapping[row["messier_id"]] = row["name_ja"]
    return mapping


# ============================================================
# SIMBAD TAP API
# ============================================================

def query_simbad_tap(adql_query, max_retries=3):
    """SIMBAD TAP同期クエリをHTTPで実行し、JSON結果を返す"""
    # クエリ文字列を正規化(余分な空白・改行を除去)
    normalized_query = " ".join(adql_query.split())

    params = {
        "REQUEST": "doQuery",
        "LANG": "ADQL",
        "FORMAT": "json",
        "MAXREC": "50000",
        "QUERY": normalized_query,
    }
    data = urllib.parse.urlencode(params).encode("utf-8")

    for attempt in range(max_retries):
        try:
            req = urllib.request.Request(SIMBAD_TAP_URL, data=data)
            req.add_header("User-Agent", "SoraNoTsuji/1.0 (celestial-app)")
            with urllib.request.urlopen(req, timeout=120) as resp:
                result = json.loads(resp.read().decode("utf-8"))
                return result
        except urllib.error.HTTPError as e:
            error_body = e.read().decode("utf-8", errors="replace")
            print(f"  HTTPエラー {e.code}: {e.reason}")
            print(f"  サーバー応答: {error_body[:500]}")
            # 400系エラーはクエリ自体の問題なのでリトライしない
            if 400 <= e.code < 500:
                raise
            if attempt < max_retries - 1:
                wait = 2 ** (attempt + 1)
                print(f"  {wait}秒待機中... (リトライ {attempt + 1}/{max_retries})")
                time.sleep(wait)
            else:
                raise
        except urllib.error.URLError as e:
            print(f"  接続エラー: {e.reason} (リトライ {attempt + 1}/{max_retries})")
            if attempt < max_retries - 1:
                wait = 2 ** (attempt + 1)
                print(f"  {wait}秒待機中...")
                time.sleep(wait)
            else:
                raise

    return None


def parse_tap_json(result):
    """TAP JSON結果をリストの辞書に変換"""
    if not result or "data" not in result:
        return []
    columns = [col["name"] for col in result["metadata"]]
    rows = []
    for data_row in result["data"]:
        row_dict = {}
        for i, col_name in enumerate(columns):
            row_dict[col_name] = data_row[i]
        rows.append(row_dict)
    return rows


# ============================================================
# データ取得関数
# ============================================================

def fetch_bright_stars():
    """V等級 ≤ 6.0の恒星をSIMBAD TAPで取得"""
    print("V等級 ≤ 6.0 の恒星を取得中...")

    query = f"""
    SELECT basic.main_id, basic.oid, basic.ra, basic.dec, V AS mag,
           basic.otype, basic.otype_txt, basic.sp_type
    FROM basic
    JOIN allfluxes ON basic.oid = allfluxes.oidref
    WHERE V <= {V_MAG_LIMIT}
      AND V IS NOT NULL
      AND basic.ra IS NOT NULL
      AND basic.dec IS NOT NULL
    ORDER BY V ASC
    """

    result = query_simbad_tap(query)
    rows = parse_tap_json(result)
    print(f"  取得件数: {len(rows)}")
    return rows


def fetch_messier_objects():
    """メシエ天体 M1〜M110 を取得(IN句方式)"""
    print("メシエ天体を取得中...")

    # SIMBAD識別名ではM1はnormIdにより "M   1" となるため、ident.idで検索
    # IN句でまとめてクエリ
    messier_ids = ", ".join([f"'M   {i}'" if i < 10
                            else f"'M  {i}'" if i < 100
                            else f"'M {i}'" for i in range(1, 111)])

    query = f"""
    SELECT ident.id AS messier_id, basic.main_id, basic.oid,
           basic.ra, basic.dec, V AS mag, basic.otype, basic.otype_txt
    FROM ident
    JOIN basic ON ident.oidref = basic.oid
    LEFT JOIN allfluxes ON basic.oid = allfluxes.oidref
    WHERE ident.id IN ({messier_ids})
      AND basic.ra IS NOT NULL AND basic.dec IS NOT NULL
    """

    result = query_simbad_tap(query)
    rows = parse_tap_json(result)
    print(f"  取得件数: {len(rows)}")
    return rows


def fetch_identifiers(oid_list):
    """指定したoid群の識別名を取得(バッチ分割)"""
    print("識別名を取得中...")

    all_rows = []
    batch_size = 5000

    for i in range(0, len(oid_list), batch_size):
        batch = oid_list[i:i + batch_size]
        oid_csv = ", ".join(str(oid) for oid in batch)

        query = f"""
        SELECT oidref, id
        FROM ident
        WHERE oidref IN ({oid_csv})
        """

        result = query_simbad_tap(query)
        rows = parse_tap_json(result)
        all_rows.extend(rows)
        print(f"  バッチ {i // batch_size + 1}: {len(rows)} 件")

        if i + batch_size < len(oid_list):
            time.sleep(QUERY_INTERVAL)

    print(f"  識別名合計: {len(all_rows)} 件")
    return all_rows


# ============================================================
# 変換・生成関数
# ============================================================

def ra_deg_to_hours(ra_deg):
    """RA(度) → RA(時) 変換。Astronomy Engine互換形式。"""
    return round(ra_deg / 15.0, DECIMAL_PLACES)


def parse_bayer_designation(main_id):
    """
    SIMBADのmain_idからバイエル符号/フラムスティード番号を解析
    例: "* alf CMa" → ("alf", "CMa", None)
        "* alf Cen A" → ("alf", "Cen", "A")
        "* mu.01 Sco" → ("mu.01", "Sco", None)
        "* bet01 Cyg A" → ("bet01", "Cyg", "A")
        "*  12 Sco A" → ("12", "Sco", "A")
    戻り値: (greek_or_num, constellation, suffix) or (None, None, None)
    """
    match = re.match(r'^\*\s+(\w+\.?\d*)\s+(\w+)(?:\s+([A-Z]))?$', main_id)
    if match:
        return match.group(1), match.group(2), match.group(3)
    return None, None, None


def generate_name_ja(main_id, identifiers, star_names_ja,
                     constellation_ja, greek_letters):
    """天体の日本語名を生成"""
    # 1. 固有名テーブルから検索
    if main_id in star_names_ja:
        return star_names_ja[main_id]

    # 2. バイエル符号/フラムスティード番号から日本語名を自動生成
    greek_key, const_abbr, suffix = parse_bayer_designation(main_id)
    if greek_key and const_abbr:
        const_ja = constellation_ja.get(const_abbr, const_abbr)
        # ギリシャ文字変換(番号付き対応: mu.01→μ01, bet01→β01)
        base_key = re.match(r'^([a-z]+\.?)', greek_key)
        if base_key:
            base = base_key.group(1)
            num_part = greek_key[len(base):]
            greek_letter = greek_letters.get(base, greek_key)
            if num_part:
                greek_letter = f"{greek_letter}{num_part}"
        else:
            greek_letter = greek_key
        suffix_str = suffix if suffix else ""
        return f"{const_ja} {greek_letter}星{suffix_str}"

    # 3. 変光星(V* ...)からの星座名抽出
    v_match = re.match(r'^V\*\s+\S+\s+(\w+)$', main_id)
    if v_match:
        const_abbr = v_match.group(1)
        const_ja = constellation_ja.get(const_abbr)
        if const_ja:
            var_name = main_id.replace("V* ", "")
            return f"{const_ja} {var_name}"

    # 4. NAME天体
    if main_id.startswith("NAME "):
        return main_id.replace("NAME ", "")

    # 5. HD番号があればそれを使用
    for ident in identifiers:
        if ident.startswith("HD "):
            return ident
    # 6. HIP番号にフォールバック
    for ident in identifiers:
        if ident.startswith("HIP "):
            return ident

    # 7. main_idをそのまま使用
    return main_id


def generate_keys(name_ja, main_id, identifiers, otype_txt,
                  constellation_ja, greek_letters):
    """検索キーワードを生成(日本語・英語統合)"""
    keys = []

    # 天体名(日本語名)を最優先で追加
    if name_ja:
        keys.append(name_ja)

    # 星座日本語名
    greek_key, const_abbr, suffix = parse_bayer_designation(main_id)
    if const_abbr:
        const_ja = constellation_ja.get(const_abbr, "")
        if const_ja and const_ja not in name_ja:
            keys.append(const_ja)

    # 天体type日本語名
    otype_ja = OTYPE_JA.get(otype_txt, "")
    if otype_ja:
        keys.append(otype_ja)

    # main_id(英語)
    keys.append(main_id)

    # 主要識別名(英語)
    for ident in identifiers:
        if any(ident.startswith(prefix) for prefix in
               ["HD ", "HIP ", "HR ", "NGC ", "IC ", "NAME "]):
            keys.append(ident)
            if len(keys) >= 8:
                break

    # 重複除去(順序保持)
    seen = set()
    unique_keys = []
    for k in keys:
        if k not in seen:
            seen.add(k)
            unique_keys.append(k)

    return ", ".join(unique_keys)


# ============================================================
# JSON構築
# ============================================================

def build_json(stars, messier, all_identifiers,
               star_names_ja, messier_names_ja,
               constellation_ja, greek_letters):
    """最終JSONデータを構築"""
    print("JSONデータを構築中...")

    # 識別名をoid別に整理
    ident_map = {}
    for row in all_identifiers:
        oid = row["oidref"]
        if oid not in ident_map:
            ident_map[oid] = []
        ident_map[oid].append(row["id"])

    output = []
    seen_oids = set()

    # 恒星データ
    for row in stars:
        oid = row["oid"]
        main_id = row["main_id"]
        if oid in seen_oids:
            continue
        seen_oids.add(oid)
        identifiers = ident_map.get(oid, [])
        name_ja = generate_name_ja(
            main_id, identifiers,
            star_names_ja, constellation_ja, greek_letters)
        otype_txt = row.get("otype_txt", "") or ""
        entry = {
            "name": name_ja,
            "ra": ra_deg_to_hours(float(row["ra"])),
            "dec": round(float(row["dec"]), DECIMAL_PLACES),
            "mag": round(float(row["mag"]), 2),
            "type": OTYPE_JA.get(otype_txt, "恒星"),
            "keys": generate_keys(
                name_ja, main_id, identifiers, otype_txt,
                constellation_ja, greek_letters),
        }
        output.append(entry)

    # メシエ天体
    for row in messier:
        oid = row["oid"]
        if oid in seen_oids:
            continue
        seen_oids.add(oid)
        identifiers = ident_map.get(oid, [])
        # messier_idからM番号を抽出(例: "M   1" → "M1")
        messier_num = row["messier_id"].replace(" ", "")
        name_ja = messier_names_ja.get(messier_num, messier_num)
        mag_value = float(row["mag"]) if row["mag"] is not None else None
        otype_txt = row.get("otype_txt", "") or ""
        otype_ja = OTYPE_JA.get(otype_txt, "深宇宙天体")
        entry = {
            "name": name_ja,
            "ra": ra_deg_to_hours(float(row["ra"])),
            "dec": round(float(row["dec"]), DECIMAL_PLACES),
            "mag": round(mag_value, 2) if mag_value is not None else None,
            "type": otype_ja,
            "keys": f"{name_ja}, メシエ天体, {messier_num}, {row['main_id']}",
        }
        output.append(entry)

    # 等級順ソート(Noneは末尾)
    output.sort(key=lambda x: (x["mag"] is None, x["mag"] if x["mag"] is not None else 99))
    return output


# ============================================================
# メイン処理
# ============================================================

def main():
    print("=" * 60)
    print("SIMBAD天体データ取得スクリプト (HTTP直接方式)")
    print("依存: Python標準ライブラリのみ (pip install不要)")
    print("=" * 60)

    # CSVマッピング読み込み
    print("\nCSVマッピングファイルを読み込み中...")
    constellation_ja = load_constellation_ja()
    print(f"  星座: {len(constellation_ja)} 件")
    greek_letters = load_greek_letters()
    print(f"  ギリシャ文字: {len(greek_letters)} 件")
    star_names_ja = load_star_names_ja()
    print(f"  恒星固有名: {len(star_names_ja)} 件")
    messier_names_ja = load_messier_names_ja()
    print(f"  メシエ天体名: {len(messier_names_ja)} 件")

    # Step 1: 恒星データ取得
    print()
    stars = fetch_bright_stars()
    time.sleep(QUERY_INTERVAL)

    # Step 2: メシエ天体取得
    messier = fetch_messier_objects()
    time.sleep(QUERY_INTERVAL)

    # Step 3: 全oidを集めて識別名を取得
    all_oids = list(set(
        [row["oid"] for row in stars] +
        [row["oid"] for row in messier]
    ))
    print(f"\n全天体数(重複除去後): {len(all_oids)}")
    identifiers = fetch_identifiers(all_oids)

    # Step 4: JSON構築
    print()
    output = build_json(
        stars, messier, identifiers,
        star_names_ja, messier_names_ja,
        constellation_ja, greek_letters)

    # Step 5: ファイル出力
    output_path = os.path.join(SCRIPT_DIR, OUTPUT_FILE)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"\n完了: {OUTPUT_FILE} に {len(output)} 件出力しました")

    # サンプル表示
    print("\n--- サンプル(上位5件) ---")
    for entry in output[:5]:
        print(f"  {entry['name']}: RA={entry['ra']}h, Dec={entry['dec']}°, "
              f"Mag={entry['mag']}, Type={entry['type']}")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
# 名山対応表(meizan-map.csv)から、アプリが読む山データ data/mountains.json を作る。
# 使い方: python3 tools/kashimap/make-mountains-json.py
# 形: {"source":{...}, "count":N, "mountains":[{id,seq,name,yomi,peak,alias,elev,kind,pref,prefCode,lat,lon,lists,state}]}
import csv, json, os, datetime
HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'meizan-map.csv')
OUT = os.path.join(HERE, '..', '..', 'data', 'mountains.json')
PREF = ['北海道','青森県','岩手県','宮城県','秋田県','山形県','福島県','茨城県','栃木県','群馬県','埼玉県','千葉県','東京都','神奈川県',
        '新潟県','富山県','石川県','福井県','山梨県','長野県','岐阜県','静岡県','愛知県','三重県','滋賀県','京都府','大阪府','兵庫県',
        '奈良県','和歌山県','鳥取県','島根県','岡山県','広島県','山口県','徳島県','香川県','愛媛県','高知県','福岡県','佐賀県','長崎県',
        '熊本県','大分県','宮崎県','鹿児島県','沖縄県']
CODE = {n: i + 1 for i, n in enumerate(PREF)}   # JIS X 0401
rows = list(csv.DictReader(open(SRC, encoding='utf-8-sig')))
out = []; xn = 0
for r in rows:
    prefs = [p for p in r['都道府県'].replace('/', ' ').split() if p]
    codes = sorted(CODE[p] for p in prefs if p in CODE)
    prefs = [PREF[c - 1] for c in codes]                 # コード順に並べ替えて格納(Q8)
    lists = [k for k, col in (('100', '百名山'), ('200', '二百名山'), ('300', '三百名山'), ('high', '百高山')) if r[col] == '1']
    if r['索引番号']:
        mid = r['索引番号']; seq = int(r['連番']); src = 'gsi'
    else:
        xn += 1; mid = f'x{xn}'; seq = 0; src = 'wikipedia+dem'
    alias = [a for a in r['別名(検索用)'].split('/') if a]
    out.append({'id': mid, 'seq': seq, 'name': r['表示山名'], 'yomi': r['表示よみ'], 'peak': r['山頂名'], 'alias': alias,
                'elev': int(float(r['標高(m)'])) if r['標高(m)'] else None, 'kind': r['種別'], 'pref': prefs, 'prefCode': codes,
                'lat': float(r['緯度']), 'lon': float(r['経度']), 'lists': lists, 'state': r['確認状態'], 'src': src})
doc = {'source': {'gsi': '国土地理院「日本の主な山岳標高一覧(1003山)」(2026-03-31版)を加工して作成(国土地理院コンテンツ利用規約)',
                  'lists': 'Wikipedia(日本百名山・日本二百名山・日本三百名山・日本の山一覧(高さ順) 2026-09-20取得)を転記。選定者: 深田久弥/深田クラブ/日本山岳会。百高山=標高順上位100',
                  'extra': '地理院1003山に無い三百名山4座はWikipedia座標→地理院DEM5A最高画素→依頼者確認(第147)',
                  'generated': datetime.date.today().isoformat(), 'tool': 'tools/kashimap/make-mountains-json.py'},
       'count': len(out), 'mountains': out}
os.makedirs(os.path.dirname(OUT), exist_ok=True)
json.dump(doc, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
n100 = sum(1 for m in out if '100' in m['lists']); nany = sum(1 for m in out if m['lists'])
print(f'wrote {OUT}: {len(out)} mountains, 百名山 {n100}, 名山いずれか {nany}, その他 {len(out)-nany}, size {os.path.getsize(OUT)} bytes')

#!/usr/bin/env python3
# 名山対応表の生成: 地理院「日本の主な山岳標高(1003山)」CSV を土台に、
# 百名山・二百名山・三百名山・百高山(標高順上位100)の各リストを索引番号で結び付ける。
# 入力: src/1003zan-20260331.csv (Shift_JIS・地理院原本), src/meizan-lists.json (Wikipediaから転記)
# 出力: meizan-map.csv (UTF-8 BOM付き。1行=地理院の1山頂[名山に無い山は「その他」])
# 使い方: python3 tools/kashimap/build-meizan-map.py
import csv, json, re, math, unicodedata, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
SRC_GSI = os.path.join(HERE, 'src', '1003zan-20260331.csv')
SRC_LISTS = os.path.join(HERE, 'src', 'meizan-lists.json')
OUT = os.path.join(HERE, 'meizan-map.csv')

# ---- 手動指定(自動照合が迷った/外した山。理由つき) ----
# key = (リスト, 名山側の表示名) -> (索引番号 or None, 確認状態, 備考)
OVERRIDES = {
    ('l100', '燧岳'):   ('275',   '手動指定', '同名の燧岳(青森・781m)ではなく尾瀬の燧ヶ岳(最高点=柴安嵓2356m)'),
    ('l100', '黒岳'):   ('457',   '手動指定', '百名山の黒岳=水晶岳(黒岳)2986m'),
    ('l100', '仙丈岳'): ('552',   '手動指定', '仙丈ヶ岳3033m(同標高の南岳と区別)'),
    # 第147(2026-09-21): 依頼者の検品(ヤマレコの山リストで目視確認)で確定
    ('l100', '谷川岳'): ('293-3', '依頼者確認済', '最高点オキノ耳1977m(第147・依頼者検品A)。茂倉岳1978m・一ノ倉岳1974mは別峰'),
    ('l100', '九重山'): ('926-1', '依頼者確認済', '最高点=中岳1791m(第147・依頼者検品A)。主峰の久住山は926-6(1786m)'),
    ('l100', '飯豊山'): ('228',   '依頼者確認済', '飯豊本山2105m(三角点)(第147・依頼者検品A)。連峰最高点の大日岳は229(2128m)'),
    ('l100', '那須岳'): ('249',   '依頼者確認済', '主峰=茶臼岳1915m(第147・依頼者検品B)。連峰最高点の三本槍岳は248(1917m)'),
    ('l100', '安達太良山'): ('211-2', '依頼者確認済', '本峰(乳首)1700m・三角点(第147・依頼者検品A)。鉄山1709mは211-1'),
    ('l100', '丹沢山'): ('361-2', '依頼者確認済', '名前の山=丹沢山1567m・三角点(第147・依頼者検品B)。山塊最高点の蛭ヶ岳は361-1(1673m)・塔ノ岳は361-3'),
    ('lhigh', '薬師岳（鳳凰山）'): ('549', '手動指定', '鳳凰山の薬師ヶ岳2780m'),
    ('lhigh', '地蔵岳（鳳凰山）'): ('547', '手動指定', '鳳凰山の地蔵ヶ岳2764m'),
    ('lhigh', '中岳'):  ('503',   '手動指定', '北アルプス(槍ヶ岳南)の中岳3084m。荒川中岳(577-1)と区別'),
    ('lhigh', '中岳（荒川中岳）'): ('577-1', '手動指定', '南アルプス荒川三山の中岳3084m'),
    ('l300', '吾妻山'): (None, '依頼者確認済', '広島県庄原市の吾妻山1238m。地理院1003山に無い。座標は第147で依頼者がヤマレコで確認(三百名山ページの座標は約2km東の別地点だった)'),
    ('l300', '二岐山'): (None, '依頼者確認済', '福島県。地理院1003山に無い。座標は第147で依頼者確認(OK)'),
    ('l300', '諏訪山'): (None, '依頼者確認済', '群馬県。地理院1003山に無い。座標は第147で依頼者確認(OK)'),
    ('l300', '藤原岳'): (None, '依頼者確認済', '三重県/滋賀県。地理院1003山に無い。座標は第147で依頼者確認(OK)'),
}
# 自動照合の根拠が弱かったが、AIが目視で確かめた表記違い(依頼者の検品は不要と判断したもの)。
# key = (リスト, 名山側の表示名) -> 備考
CONFIRMED = {
    ('l100', '阿寒岳'): '百名山の阿寒岳=雌阿寒岳1499m',
    ('l100', '利尻岳'): '表記違い: 利尻岳=利尻山(利尻富士)',
    ('l100', 'トムラウシ'): '表記違い: トムラウシ=トムラウシ山',
    ('l100', '後方羊蹄山'): '表記違い: 後方羊蹄山=羊蹄山(蝦夷富士)',
    ('l100', '早池峰'): '表記違い: 早池峰=早池峰山',
    ('l100', '吾妻山'): '百名山の吾妻山=西吾妻山2035m(連峰最高点)',
    ('l100', '奥白根山'): '奥白根山=日光白根山(地理院は白根山2578m)',
    ('l100', '会津駒ヶ岳'): '地理院は駒ヶ岳2133m(福島)',
    ('l100', '魚沼駒ヶ岳'): '魚沼駒ヶ岳=越後駒ヶ岳(地理院は駒ヶ岳2003m・新潟)。同標高の景鶴山とは別',
    ('l100', '草津白根山'): '最高点=本白根山2171m(Wikipedia表と同じ)',
    ('l100', '甲武信岳'): '表記違い: 甲武信岳=甲武信ヶ岳',
    ('l100', '大菩薩岳'): '表記違い: 大菩薩岳=大菩薩嶺',
    ('l100', '八ヶ岳'): '八ヶ岳の最高点=赤岳2899m',
    ('l100', '鹿島槍岳'): '表記違い: 鹿島槍岳=鹿島槍ヶ岳',
    ('l100', '笠ヶ岳'): '岐阜の笠ヶ岳2897m(同名の笠ヶ岳304[群馬]とは別)',
    ('l100', '穂高岳'): '穂高岳の最高点=奥穂高岳3190m',
    ('l100', '木曽駒ヶ岳'): '地理院は駒ヶ岳2956m(長野・木曽)',
    ('l100', '甲斐駒ヶ岳'): '地理院は駒ヶ岳2967m(山梨/長野)',
    ('l100', '鳳凰山'): '鳳凰山の最高点=観音ヶ岳2841m(百名山の表は2840m)',
    ('l100', '悪沢岳'): '表記違い: 悪沢岳=東岳(悪沢岳)',
    ('l100', '大峰山'): '大峰山の最高点=八経ヶ岳1915m',
    ('lhigh', '白馬鑓ヶ岳'): '表記違い: 白馬鑓ヶ岳=鑓ヶ岳2903m',
    ('lhigh', '木曽駒ヶ岳'): '地理院は駒ヶ岳2956m(長野・木曽)',
    ('lhigh', '甲斐駒ヶ岳'): '地理院は駒ヶ岳2967m(山梨/長野)',
    ('lhigh', '観音岳（鳳凰山）'): '表記違い: 観音岳=観音ヶ岳',
    ('lhigh', '悪沢岳（荒川東岳）'): '表記違い: 悪沢岳=東岳(悪沢岳)',
}
# 地理院1003山に無い山の座標: Wikipediaの座標の周り300mで地理院DEM5A(z15)の最高画素を探した値(2026-09-21・第146)。
# 標高APIでも照合済み。依頼者の検品待ち。key = 名山側の表示名 -> (緯度, 経度, DEMの標高, 備考)
EXTRA_COORDS = {
    '二岐山': (37.246472, 139.967258, 1543.9, '地理院DEM5Aの最高画素。Wikipedia座標から約10m'),
    '諏訪山': (36.039921, 138.729494, 1548.4, '地理院DEM5Aの最高画素。Wikipedia座標から約10m'),
    '藤原岳': (35.158705, 136.452749, 1141.1, '地理院DEM5Aの最高画素(展望丘)。Wikipedia座標から約110m西'),
    '吾妻山': (35.068239, 133.033125, 1237.8, '依頼者の座標(35.068167,133.032972・ヤマレコ)の周り300mの地理院DEM5A最高画素(第147)'),
}
LIST_LABEL = {'l100': '百名山', 'l200': '二百名山', 'l300': '三百名山', 'lhigh': '百高山'}

def norm(s):
    s = unicodedata.normalize('NFKC', s or '').replace(' ', '').replace('　', '')
    s = (s.replace('ケ', 'ヶ').replace('が', 'ヶ').replace('ガ', 'ヶ').replace('龍', '竜').replace('劔', '剱')
           .replace('剣', '剱').replace('嶽', '岳').replace('ッ', 'ツ').replace('ヅ', 'ツ'))
    return re.sub(r'[（(].*?[)）]', '', s)
def ynorm(s):
    return re.sub(r'[^ぁ-ゖー]', '', (s or '').replace('ヶ', 'が').replace('ケ', 'が'))
def dist_km(a, b, c, e):
    R = 6371; p1, p2 = math.radians(a), math.radians(c); dl = math.radians(e - b)
    return R * math.acos(max(-1, min(1, math.sin(p1) * math.sin(p2) + math.cos(p1) * math.cos(p2) * math.cos(dl))))

rows = list(csv.reader(open(SRC_GSI, encoding='cp932')))
header, rows = rows[0], rows[1:]
gsi = []
for r in rows:
    m = re.match(r'^(.*?)(?:＜(.*?)＞)?$', r[2]); my = re.match(r'^(.*?)(?:＜(.*?)＞)?$', r[3])
    gsi.append({'seq': r[0], 'idx': r[1], 'name': m.group(1), 'peak': m.group(2) or '', 'yomi': my.group(1),
                'peakyomi': my.group(2) or '', 'elev': float(r[4]) if r[4] else None, 'kind': r[5], 'pref': r[6],
                'lat': float(r[7]), 'lon': float(r[8]), 'raw': r[2], 'rawyomi': r[3]})
by_idx = {g['idx']: g for g in gsi}
lists = json.load(open(SRC_LISTS, encoding='utf-8'))

def match(e):
    n = norm(e['name']); y = ynorm(e.get('yomi', ''))
    ev = float(re.sub(r'[^\d\.]', '', e['elev'])) if e.get('elev') else None
    cands = []
    for g in gsi:
        score = 0; why = []
        gn, gp, gy, gpy = norm(g['name']), norm(g['peak']), ynorm(g['yomi']), ynorm(g['peakyomi'])
        if n and (n == gn or n == gp): score += 3; why.append('名前一致')
        elif n and len(n) >= 2 and (n in gn or gn in n): score += 1; why.append('名前部分一致')
        if y and (y == gy or y == gpy): score += 3; why.append('よみ一致')
        if ev is not None and g['elev'] is not None:
            de = abs(ev - g['elev'])
            if de <= 1.5: score += 3; why.append('標高一致')
            elif de <= 6: score += 1; why.append(f'標高近い({de:.0f}m)')
        if e.get('lat') and e.get('lon'):
            dk = dist_km(e['lat'], e['lon'], g['lat'], g['lon'])
            if dk <= 1.5: score += 4; why.append(f'距離{dk:.1f}km')
            elif dk <= 5: score += 2; why.append(f'距離{dk:.1f}km')
        if e.get('pref'):
            pf = [p for p in re.split(r'[／/、\s]+', e['pref'].replace('県', '県 ').replace('道', '道 ').replace('府', '府 ')) if p]
            if any(p in g['pref'] for p in pf): score += 1; why.append('県一致')
        if score >= 4: cands.append((score, g, why))
    cands.sort(key=lambda c: -c[0])
    return cands

# ---- 各リストの各山を地理院の行へ ----
assign = {}   # idx -> {'flags':set, 'names':[], 'yomis':[], 'how':[], 'state':set, 'notes':[]}
extra = []    # 地理院に無い山
for key in ['l100', 'l200', 'l300', 'lhigh']:
    for e in lists[key]:
        name = e['name']; ov = OVERRIDES.get((key, name))
        if ov:
            idx, state, note = ov; how = '手動'
        else:
            c = match(e)
            if not c:
                idx, state, note, how = None, '地理院に無し', '自動照合で候補なし', '自動'
            else:
                best = c[0]
                tie = [x for x in c[1:] if x[0] >= best[0] - 1]
                idx = best[1]['idx']; how = '自動(' + '・'.join(best[2]) + ')'
                cf = CONFIRMED.get((key, name))
                if cf: state, note = '目視確認済', cf
                elif best[0] >= 6 and not tie: state, note = '自動一致', ''
                elif tie: state, note = '要確認', '候補が拮抗: ' + ' / '.join(f"{x[1]['raw']}({x[1]['idx']})" for x in tie[:3])
                else: state, note = '要確認', '照合の根拠が弱い(名前の表記が違う等)'
        if idx is None:
            extra.append({'list': key, 'entry': e, 'state': state, 'note': note}); continue
        a = assign.setdefault(idx, {'flags': set(), 'names': [], 'yomis': [], 'how': [], 'state': set(), 'notes': []})
        a['flags'].add(key)
        if name not in a['names']: a['names'].append(name)
        if e.get('yomi') and e['yomi'] not in a['yomis']: a['yomis'].append(e['yomi'])
        a['how'].append(f"{LIST_LABEL[key]}:{how}")
        a['state'].add(state)
        if note: a['notes'].append(f"{LIST_LABEL[key]}: {note}")

def state_of(states):
    for s in ['要確認', '依頼者確認済', '手動指定', '目視確認済', '自動一致']:
        if s in states: return s
    return '自動一致'

cols = ['連番', '索引番号', '表示山名', '表示よみ', '地理院山名', '山頂名', '標高(m)', '種別', '都道府県', '緯度', '経度',
        '百名山', '二百名山', '三百名山', '百高山', '別名(検索用)', '照合方法', '確認状態', '備考']
out_rows = []
for g in gsi:
    a = assign.get(g['idx'])
    alias = []
    for s in [g['name'], g['peak']] + re.findall(r'[（(](.*?)[)）]', g['raw']):
        if s and s not in alias: alias.append(s)
    if a:
        disp = a['names'][0]; yomi = a['yomis'][0] if a['yomis'] else g['yomi']
        for s in a['names'][1:]:
            if s not in alias: alias.append(s)
        flags = [('1' if k in a['flags'] else '') for k in ['l100', 'l200', 'l300', 'lhigh']]
        how = ' / '.join(a['how']); state = state_of(a['state']); note = ' / '.join(a['notes'])
    else:
        # 名山に無い山: 峰の名前があれば「山名（山頂名）」で区別できるようにする(谷川岳の茂倉岳など)
        disp = f"{g['name']}（{g['peak']}）" if g['peak'] else g['name']
        yomi = f"{g['yomi']}（{g['peakyomi']}）" if g['peakyomi'] else g['yomi']
        flags = ['', '', '', '']; how = ''; state = 'その他'; note = ''
    alias = [s for s in alias if s != disp]
    out_rows.append([g['seq'], g['idx'], disp, yomi, re.sub(r'[（(].*?[)）]', '', g['name']), g['peak'],
                     f"{g['elev']:.0f}" if g['elev'] is not None else '', g['kind'], g['pref'], f"{g['lat']:.6f}", f"{g['lon']:.6f}",
                     *flags, '/'.join(alias), how, state, note])
for x in extra:
    e = x['entry']; k = x['list']
    ec = EXTRA_COORDS.get(e['name'])
    if ec:
        lat, lon, dem_elev, ecnote = ec
        kind = '地理院DEM最高画素'; note = x['note'] + f' / 座標は{ecnote}(DEM標高{dem_elev:.1f}m)'
    else:
        lat, lon = e.get('lat'), e.get('lon'); kind = 'Wikipedia座標(仮)'; note = x['note']
    out_rows.append(['', '', e['name'], e.get('yomi', ''), '', '', e.get('elev', ''), kind, e.get('pref', ''),
                     f"{lat:.6f}" if lat else '', f"{lon:.6f}" if lon else '',
                     '1' if k == 'l100' else '', '1' if k == 'l200' else '', '1' if k == 'l300' else '', '1' if k == 'lhigh' else '',
                     '', f"{LIST_LABEL[k]}:Wikipedia", x['state'], note])

with open(OUT, 'w', encoding='utf-8-sig', newline='') as f:
    w = csv.writer(f); w.writerow(cols); w.writerows(out_rows)

# ---- 集計 ----
cnt = {k: sum(1 for r in out_rows if r[11 + i] == '1') for i, k in enumerate(['百名山', '二百名山', '三百名山', '百高山'])}
union = sum(1 for r in out_rows if any(r[11:15]))
states = {}
for r in out_rows: states[r[17]] = states.get(r[17], 0) + 1
print('rows:', len(out_rows), 'GSI:', len(gsi), 'extra(地理院に無し):', len(extra))
print('flags:', cnt, 'union:', union)
print('states:', states)
print('--- 要確認 ---')
for r in out_rows:
    if r[17] == '要確認': print(' ', r[1], r[2], r[6], r[8], '|', r[18])
print('--- 地理院に無し ---')
for r in out_rows:
    if r[17] == '地理院に無し': print(' ', r[2], r[6], r[8], r[9], r[10], '|', r[18])

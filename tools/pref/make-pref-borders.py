#!/usr/bin/env python3
# 国土数値情報 行政区域(N03)から、都道府県の輪郭データ data/pref/v1/pref-borders.json を作る。
# 使い方: python3 -I tools/pref/make-pref-borders.py [--work DIR] [--tol 500] [--max-mb 3] [--prefs 01,02,..] [--keep-dl]
#   --work   作業ディレクトリ(既定: $TMPDIR/pref-borders)。dl/ にzipを1県ずつ落とし、使い終えたら消す。
#            edges/ に県ごとの輪郭辺(16バイト/辺)を置く。run.log に進捗を書く。
#   --tol    海岸線のDouglas-Peucker許容(m)。県境は間引かない。
#   --max-mb 出力がこれを超えたら海岸線の許容を2倍(500→1000m)にしてもう一度書く。
#   --min-ring-m 海岸線だけでできた小さなリング(岩礁など)で、外接矩形の長辺がこれ未満のものは落とす(0=落とさない)。
#            N03は数mの岩礁も1ポリゴンとして持っており、全国で数万個になる。県の判定には効かないので既定で落とす。
# 仕組み:
#   1) 県ごとに N03-20260101_NN.geojson をzipから直接読み、全リングの辺を「2回出た辺は消える」集合(偶奇)で数える。
#      市区町村どうしが接する辺は2回出て消え、残った辺が県の輪郭。頂点は1e-7度の整数で突き合わせる(元データは小数9桁)。
#   2) 県の輪郭辺を edges/NN.bin に保存(zipは削除)。bboxが重なる県どうしで輪郭辺の共通部分をとる → 県境の辺。
#   3) 県ごとに輪郭辺を鎖にしてリングを作り、県境(相手の県が同じ連続区間)と海岸線の区間に切る。
#      県境の区間(アーク)は両県で同じ番号を共有し、全解像度のまま。海岸線の区間はDPで間引く。
#      間引いた弦が他県の陸(海岸線の頂点)を囲んだり横切ったりしないように、近くの他県の頂点を格子に入れておき、
#      弦と元の海岸線で囲む領域に他県の頂点が入る弦は最遠点で分けて作り直す(位相の保護。狭い水道の島が隣県の多角形に飲まれない)。
#   4) 座標を1e-5度の整数に量子化し、アークは差分符号(Google polyline形式か整数配列の小さい方)で書く。
# 安全弁: ダウンロードは https 限定・1県 1,500MB まで・zipの中身は 2GB まで。
# 依存: Python 3 標準ライブラリのみ + curl。
import argparse, array, datetime, json, math, os, subprocess, sys, time, zipfile

URL = 'https://nlftp.mlit.go.jp/ksj/gml/data/N03/N03-2026/N03-20260101_{nn}_GML.zip'
DATASET_PAGE = 'https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-N03-2026.html'   # 出典表記に入れる「当該ページのURL」
EDITION = '2026-01-01'
MAX_MEMBER_BYTES = 2 * 1024 ** 3   # zipの中のGeoJSON 1本の上限(安全弁)
ATTRIBUTION = f'「国土数値情報（行政区域データ）」（国土交通省）（{DATASET_PAGE}）を加工して作成'   # 利用規約の出典記載例の形
ATTRIBUTION_SHORT = '国土数値情報(行政区域データ)(国土交通省)を加工して作成'   # 画面の狭い所用
PREF = ['北海道','青森県','岩手県','宮城県','秋田県','山形県','福島県','茨城県','栃木県','群馬県','埼玉県','千葉県','東京都','神奈川県',
        '新潟県','富山県','石川県','福井県','山梨県','長野県','岐阜県','静岡県','愛知県','三重県','滋賀県','京都府','大阪府','兵庫県',
        '奈良県','和歌山県','鳥取県','島根県','岡山県','広島県','山口県','徳島県','香川県','愛媛県','高知県','福岡県','佐賀県','長崎県',
        '熊本県','大分県','宮崎県','鹿児島県','沖縄県']
HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(HERE, '..', '..', 'data', 'pref', 'v1')
OUT = os.path.join(OUT_DIR, 'pref-borders.json')
M_PER_DEG = 6371000.0 * math.pi / 180.0
SCALE = 10 ** 7            # 突き合わせ用の整数座標(1e-7度)
Q = 100                    # 1e-7 → 1e-5 への量子化係数
XOFF = 1800 * 10 ** 6      # 経度 -180..180 を正にずらす
YOFF = 900 * 10 ** 6
SHIFT = 31                 # 緯度側のビット幅(1.8e9 < 2^31)

LOG = None
def log(msg):
    line = f'[{datetime.datetime.now().strftime("%H:%M:%S")}] {msg}'
    print(line, flush=True)
    if LOG:
        LOG.write(line + '\n'); LOG.flush()

def vkey(x, y):
    return ((int(round(x * SCALE)) + XOFF) << SHIFT) | (int(round(y * SCALE)) + YOFF)
def vxy(k):                 # 1e-7度の整数 (ix, iy)
    return (k >> SHIFT) - XOFF, (k & ((1 << SHIFT) - 1)) - YOFF
def ekey(a, b):
    return (a << 63) | b if a < b else (b << 63) | a

# ---------- 1) 県ごとの輪郭辺 ----------
def download(nn, dl_dir):
    os.makedirs(dl_dir, exist_ok=True)
    path = os.path.join(dl_dir, f'N03-20260101_{nn}_GML.zip')
    url = URL.format(nn=nn)
    for attempt in range(4):
        r = subprocess.run(['curl', '-sS', '-L', '--fail', '--retry', '3', '-m', '900', '--proto', '=https', '--max-filesize', '1500M', '-o', path, url])   # 時間・大きさ・プロトコルの安全弁
        if r.returncode == 0 and os.path.getsize(path) > 1000:
            return path
        log(f'  download retry {attempt+1} for {nn} (rc={r.returncode})')
        time.sleep(5 * (attempt + 1))
    raise RuntimeError(f'download failed: {url}')

def outline_edges(nn, dl_dir, keep_dl):
    """県の全市区町村を読み、偶奇で内部の辺を消して輪郭辺を返す。"""
    zpath = download(nn, dl_dir)
    with zipfile.ZipFile(zpath) as z:
        name = [n for n in z.namelist() if n.endswith('.geojson')][0]
        info = z.getinfo(name)
        if info.file_size > MAX_MEMBER_BYTES:
            raise RuntimeError(f'{name}: {info.file_size} bytes > {MAX_MEMBER_BYTES} (安全弁。想定外の大きさ)')
        gj = json.loads(z.read(name).decode('utf-8-sig'))
    if not keep_dl:
        os.remove(zpath)
    feats = gj['features']; gj = None
    pref_name = None; nverts = 0; nrings = 0
    minx = miny = 1e9; maxx = maxy = -1e9
    parity = set()
    for f in feats:
        p = f['properties']
        if p.get('N03_001'):
            pref_name = p['N03_001']
        g = f['geometry']
        polys = g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]
        for poly in polys:
            for ring in poly:
                nrings += 1
                prev = None
                for x, y in ring:
                    nverts += 1
                    if x < minx: minx = x
                    if x > maxx: maxx = x
                    if y < miny: miny = y
                    if y > maxy: maxy = y
                    k = vkey(x, y)
                    if prev is not None and k != prev:
                        e = ekey(prev, k)
                        if e in parity: parity.remove(e)
                        else: parity.add(e)
                    prev = k
    feats = None
    arr = array.array('q')
    mask = (1 << 63) - 1
    for e in parity:
        arr.append(e >> 63); arr.append(e & mask)
    meta = {'code': nn, 'name': pref_name, 'municipal_features': 0, 'rings_raw': nrings, 'vertices_raw': nverts,
            'outline_edges': len(parity), 'bbox': [minx, miny, maxx, maxy]}
    return arr, meta

def pass1(codes, work, keep_dl):
    edir = os.path.join(work, 'edges'); os.makedirs(edir, exist_ok=True)
    metas = {}
    for nn in codes:
        mpath = os.path.join(edir, f'{nn}.json'); bpath = os.path.join(edir, f'{nn}.bin')
        if os.path.exists(mpath) and os.path.exists(bpath):
            metas[nn] = json.load(open(mpath, encoding='utf-8'))
            log(f'pass1 {nn} cached: {metas[nn]["name"]} outline_edges={metas[nn]["outline_edges"]}')
            continue
        t0 = time.time()
        arr, meta = outline_edges(nn, os.path.join(work, 'dl'), keep_dl)
        with open(bpath, 'wb') as fh: arr.tofile(fh)
        json.dump(meta, open(mpath, 'w', encoding='utf-8'), ensure_ascii=False)
        metas[nn] = meta
        log(f'pass1 {nn} {meta["name"]}: vertices={meta["vertices_raw"]} rings={meta["rings_raw"]} outline_edges={meta["outline_edges"]} ({time.time()-t0:.1f}s)')
    return metas

def load_edges(work, nn):
    arr = array.array('q')
    with open(os.path.join(work, 'edges', f'{nn}.bin'), 'rb') as fh:
        arr.frombytes(fh.read())
    return arr

# ---------- 2) 県境の辺 ----------
def bbox_overlap(a, b, margin=0.02):
    return not (a[2] + margin < b[0] or b[2] + margin < a[0] or a[3] + margin < b[1] or b[3] + margin < a[1])

def border_pairs(codes, metas, work):
    """pair (i,j) → 共有する辺(ekey)の集合。bboxが重なる県どうしだけ調べる。"""
    pairs = {}
    sets = {}
    def get_set(nn):
        if nn not in sets:
            arr = load_edges(work, nn)
            sets[nn] = {(arr[k] << 63) | arr[k + 1] for k in range(0, len(arr), 2)}
        return sets[nn]
    for ii, i in enumerate(codes):
        si = get_set(i)
        for j in codes[ii + 1:]:
            if not bbox_overlap(metas[i]['bbox'], metas[j]['bbox']):
                continue
            common = si & get_set(j)
            if common:
                pairs[(i, j)] = common
                log(f'  border {i}-{j}: {len(common)} edges')
        # 以後 i は使わないので捨てる(メモリ)
        sets.pop(i, None)
        for j in list(sets):
            if all(not bbox_overlap(metas[j]['bbox'], metas[k]['bbox']) for k in codes[ii + 1:] if k != j):
                sets.pop(j)
    return pairs

# ---------- 3) リング・アーク ----------
def chain_rings(edge_arr, partner_of):
    """輪郭辺を鎖にして閉じたリングを返す。各リング = (頂点列[閉じる], 辺ごとの相手県コード('00'=海岸))"""
    n = len(edge_arr) // 2
    adj = {}
    for k in range(n):
        a = edge_arr[2 * k]; b = edge_arr[2 * k + 1]
        adj.setdefault(a, []).append(k); adj.setdefault(b, []).append(k)
    odd = sum(1 for v in adj.values() if len(v) % 2)
    used = bytearray(n)
    rings = []; broken = 0
    for e0 in range(n):
        if used[e0]: continue
        a0 = edge_arr[2 * e0]
        verts = [a0]; parts = []
        cur = a0; e = e0
        while True:
            used[e] = 1
            a = edge_arr[2 * e]; b = edge_arr[2 * e + 1]
            nxt = b if a == cur else a
            verts.append(nxt); parts.append(partner_of(a, b))
            cur = nxt
            if cur == a0: break
            e = -1
            for x in adj[cur]:
                if not used[x]: e = x; break
            if e < 0:
                broken += 1; verts.append(a0); parts.append(parts[-1]); break
        rings.append((verts, parts))
    return rings, odd, broken

def split_arcs(verts, parts):
    """リングを、相手県が同じ連続区間(アーク)に切る。戻り: [(partner, 頂点列)]。"""
    m = len(parts)
    start = -1
    for k in range(m):
        if parts[k] != parts[k - 1]:
            start = k; break
    if start < 0:
        return [(parts[0], verts)]          # 1本の閉じたアーク
    out = []; cur = [verts[start]]; cp = parts[start]
    for t in range(m):
        k = (start + t) % m
        if parts[k] != cp:
            out.append((cp, cur)); cur = [verts[k]]; cp = parts[k]
        cur.append(verts[k + 1])
    out.append((cp, cur))
    return out

def dp_keep(xs, ys, i, j, tol2, keep, stack):
    stack.append((i, j))
    while stack:
        i, j = stack.pop()
        if j - i < 2: continue
        x1 = xs[i]; y1 = ys[i]; x2 = xs[j]; y2 = ys[j]
        dx = x2 - x1; dy = y2 - y1; L2 = dx * dx + dy * dy
        best = 0.0; bi = -1
        if L2 == 0.0:
            for k in range(i + 1, j):
                ex = xs[k] - x1; ey = ys[k] - y1; d2 = ex * ex + ey * ey
                if d2 > best: best = d2; bi = k
        else:
            for k in range(i + 1, j):
                ex = xs[k] - x1; ey = ys[k] - y1
                t = (ex * dx + ey * dy) / L2
                if t <= 0.0: d2 = ex * ex + ey * ey
                elif t >= 1.0:
                    fx = xs[k] - x2; fy = ys[k] - y2; d2 = fx * fx + fy * fy
                else:
                    px = ex - t * dx; py = ey - t * dy; d2 = px * px + py * py
                if d2 > best: best = d2; bi = k
        if best > tol2:
            keep[bi] = 1; stack.append((i, bi)); stack.append((bi, j))

def farthest(xs, ys, i, j, lo, hi):
    """lo..hi の中で弦(i,j)から最も遠い点の添字"""
    x1 = xs[i]; y1 = ys[i]; dx = xs[j] - x1; dy = ys[j] - y1; L2 = dx * dx + dy * dy
    best = -1.0; bi = -1
    for k in range(lo, hi):
        ex = xs[k] - x1; ey = ys[k] - y1
        if L2 == 0.0: d2 = ex * ex + ey * ey
        else:
            t = max(0.0, min(1.0, (ex * dx + ey * dy) / L2)); px = ex - t * dx; py = ey - t * dy; d2 = px * px + py * py
        if d2 > best: best = d2; bi = k
    return bi

# ---------- 3b) 位相の保護: 間引いた弦が他県の陸にかからないように ----------
FCELL = 50000   # 他県の頂点を入れる格子の1マス(1e-7度の整数で 0.005度≈500m)

def foreign_vertex_grid(codes, metas, work, nn, margin=0.01):
    """nn の bbox(margin度ふくらませた範囲)にある他県の輪郭の頂点を格子に入れる。戻り: (dict (cx,cy)→[(ix,iy),...] または None, 頂点数)"""
    bb = metas[nn]['bbox']
    minx = int(round((bb[0] - margin) * SCALE)); maxx = int(round((bb[2] + margin) * SCALE))
    miny = int(round((bb[1] - margin) * SCALE)); maxy = int(round((bb[3] + margin) * SCALE))
    grid = {}; cnt = 0
    for o in codes:
        if o == nn or not bbox_overlap(metas[o]['bbox'], bb, margin): continue
        arr = load_edges(work, o)
        seen = set()
        for k in arr:
            ix, iy = vxy(k)
            if ix < minx or ix > maxx or iy < miny or iy > maxy or k in seen: continue
            seen.add(k)
            grid.setdefault((ix // FCELL, iy // FCELL), []).append((ix, iy))
            cnt += 1
        arr = None; seen = None
    return (grid if cnt else None), cnt

def chord_encloses_foreign(ixs, iys, i, j, grid):
    """弦(i,j)と元の海岸線 i..j で囲む領域の中に他県の頂点があるか(境界上の共有頂点は除く)。
    海岸線どうしは本来交わらないので、弦が他県の陸を横切る/囲むなら必ず相手の頂点がこの領域に入る。"""
    minx = maxx = ixs[i]; miny = maxy = iys[i]
    for k in range(i + 1, j + 1):
        x = ixs[k]; y = iys[k]
        if x < minx: minx = x
        elif x > maxx: maxx = x
        if y < miny: miny = y
        elif y > maxy: maxy = y
    cands = []
    for cx in range(minx // FCELL, maxx // FCELL + 1):
        for cy in range(miny // FCELL, maxy // FCELL + 1):
            lst = grid.get((cx, cy))
            if lst:
                for pt in lst:
                    if minx <= pt[0] <= maxx and miny <= pt[1] <= maxy: cands.append(pt)
    if not cands: return False
    own = set(zip(ixs[i:j + 1], iys[i:j + 1]))
    for fx, fy in cands:
        if (fx, fy) in own: continue
        inside = False
        px = ixs[j]; py = iys[j]            # 閉じる辺(弦 j→i)から始めて i..j の辺を順に
        for k in range(i, j + 1):
            qx = ixs[k]; qy = iys[k]
            if (qy > fy) != (py > fy):
                if fx < px + (fy - py) * (qx - px) / (qy - py): inside = not inside
            px = qx; py = qy
        if inside: return True
    return False

def simplify_coast(vkeys, tol_m, grid=None):
    """海岸線アーク(頂点キー列)をDPで間引く。端点は残す。閉じたリングは最遠点で2分してから。
    grid(他県の頂点の格子)があれば、他県の頂点を囲む弦を最遠点で分け直す。戻り: (残した頂点キー列, 分け直した回数)"""
    n = len(vkeys)
    if n <= 2: return list(vkeys), 0
    xs = array.array('d'); ys = array.array('d')
    lat_sum = 0.0
    for k in vkeys:
        ix, iy = vxy(k); lat_sum += iy
    cosl = math.cos(math.radians(lat_sum / n / SCALE))
    ixs = array.array('q'); iys = array.array('q')
    for k in vkeys:
        ix, iy = vxy(k); xs.append(ix / SCALE * M_PER_DEG * cosl); ys.append(iy / SCALE * M_PER_DEG); ixs.append(ix); iys.append(iy)
    keep = bytearray(n); keep[0] = 1; keep[n - 1] = 1
    tol2 = float(tol_m) * tol_m; stack = []
    if vkeys[0] == vkeys[-1]:
        m = farthest(xs, ys, 0, 0, 1, n - 1); keep[m] = 1
        dp_keep(xs, ys, 0, m, tol2, keep, stack); dp_keep(xs, ys, m, n - 1, tol2, keep, stack)
        if sum(keep) < 4:                       # 小島が線に潰れないよう最低3点(四角形)は残す
            a = farthest(xs, ys, 0, m, 1, m); b = farthest(xs, ys, m, n - 1, m + 1, n - 1)
            if a >= 0: keep[a] = 1
            if b >= 0: keep[b] = 1
    else:
        dp_keep(xs, ys, 0, n - 1, tol2, keep, stack)
    splits = 0
    if grid is not None:
        kept = [k for k in range(n) if keep[k]]
        todo = [(kept[t], kept[t + 1]) for t in range(len(kept) - 1) if kept[t + 1] - kept[t] >= 2]
        while todo:
            i, j = todo.pop()
            if j - i < 2: continue
            if chord_encloses_foreign(ixs, iys, i, j, grid):
                m = farthest(xs, ys, i, j, i + 1, j); keep[m] = 1; splits += 1
                todo.append((i, m)); todo.append((m, j))
    return [vkeys[k] for k in range(n) if keep[k]], splits

def quantize(vkeys):
    """1e-7度の整数 → 1e-5度の整数 [(qx,qy),...]。連続する重複は落とす(端点は残る)。"""
    out = []
    for k in vkeys:
        ix, iy = vxy(k)
        q = (int(round(ix / Q)), int(round(iy / Q)))
        if not out or out[-1] != q: out.append(q)
    return out

# ---------- 4) 符号化 ----------
def enc_polyline(pts):
    """Google Encoded Polyline(精度1e-5、lat,lng の順)。pts は (qx=lon, qy=lat) の1e-5度整数。"""
    out = []; plat = plng = 0
    for qx, qy in pts:
        for v in (qy - plat, qx - plng):
            v = ~(v << 1) if v < 0 else (v << 1)
            while v >= 0x20:
                out.append(chr((0x20 | (v & 0x1f)) + 63)); v >>= 5
            out.append(chr(v + 63))
        plat = qy; plng = qx
    return ''.join(out)

def enc_delta(pts):
    out = []; px = py = 0
    for qx, qy in pts:
        out.append(qx - px); out.append(qy - py); px = qx; py = qy
    return out

def ring_extent_m(verts):
    """リング(頂点キー列)の外接矩形の長辺(m)"""
    minx = miny = 1 << 62; maxx = maxy = -(1 << 62)
    for k in verts:
        ix, iy = vxy(k)
        if ix < minx: minx = ix
        if ix > maxx: maxx = ix
        if iy < miny: miny = iy
        if iy > maxy: maxy = iy
    cosl = math.cos(math.radians((miny + maxy) / 2 / SCALE))
    return max((maxx - minx) * cosl, maxy - miny) / SCALE * M_PER_DEG

def pass2(codes, metas, pairs, work, tol_m, min_ring_m=0.0):
    partner_edges = {}                                   # 県 → {ekey: 相手県}
    for (i, j), es in pairs.items():
        di = partner_edges.setdefault(i, {}); dj = partner_edges.setdefault(j, {})
        for e in es: di[e] = j; dj[e] = i
    arcs = []                 # 量子化済み点列 [(qx,qy),...]
    shared_idx = {}           # 正規化キー → アーク番号
    prefs = []
    st = {'border_vertices': set(), 'coast_vertices_raw': 0, 'coast_vertices_simplified': 0, 'border_arcs': 0, 'coast_arcs': 0,
          'rings': 0, 'odd_degree_vertices': 0, 'broken_chains': 0, 'dropped_tiny_arcs': 0, 'border_arc_dups': 0,
          'dropped_small_rings': 0, 'topology_splits': 0, 'foreign_vertices': 0}
    for nn in codes:
        t0 = time.time()
        arr = load_edges(work, nn)
        pe = partner_edges.get(nn, {})
        def partner_of(a, b, pe=pe):
            return pe.get(ekey(a, b), '00')
        rings, odd, broken = chain_rings(arr, partner_of)
        arr = None
        grid, nforeign = foreign_vertex_grid(codes, metas, work, nn)   # 近くの他県の頂点(位相の保護)
        st['foreign_vertices'] += nforeign; splits = 0
        st['odd_degree_vertices'] += odd; st['broken_chains'] += broken
        ring_refs = []
        nb = nc = 0
        for verts, parts in rings:
            if min_ring_m > 0 and all(p == '00' for p in parts) and ring_extent_m(verts) < min_ring_m:
                st['dropped_small_rings'] += 1; continue
            refs = []
            for partner, vk in split_arcs(verts, parts):
                if partner != '00':
                    st['border_vertices'].update(vk)
                    closed = vk[0] == vk[-1]
                    if closed:                      # 閉じた共有アーク: 最小頂点から始める向きで正規化
                        body = vk[:-1]; m = body.index(min(body)); body = body[m:] + body[:m]
                        rev = [body[0]] + body[1:][::-1]
                        fwd_t = tuple(body); rev_t = tuple(rev)
                    else:
                        fwd_t = tuple(vk); rev_t = tuple(reversed(vk))
                    forward = fwd_t <= rev_t
                    key = fwd_t if forward else rev_t
                    if key in shared_idx:
                        idx = shared_idx[key]
                        if idx is None: continue
                        st['border_arc_dups'] += 1
                    else:
                        pts = quantize(list(key) + ([key[0]] if closed else []))
                        if len(pts) < 2:
                            shared_idx[key] = None; st['dropped_tiny_arcs'] += 1; continue
                        idx = len(arcs); arcs.append(pts); shared_idx[key] = idx; st['border_arcs'] += 1
                    refs.append(idx if forward else ~idx); nb += 1
                else:
                    st['coast_vertices_raw'] += len(vk)
                    simp, sp = simplify_coast(vk, tol_m, grid); splits += sp
                    pts = quantize(simp)
                    st['coast_vertices_simplified'] += len(pts)
                    if len(pts) < 2:
                        st['dropped_tiny_arcs'] += 1; continue
                    refs.append(len(arcs)); arcs.append(pts); st['coast_arcs'] += 1; nc += 1
            if refs:
                ring_refs.append(refs); st['rings'] += 1
        bb = metas[nn]['bbox']
        prefs.append({'code': nn, 'name': metas[nn]['name'], 'bbox': [round(v, 5) for v in bb], 'rings': ring_refs})
        st['topology_splits'] += splits; grid = None
        log(f'pass2 {nn} {metas[nn]["name"]}: rings={len(rings)} border_arcs={nb} coast_arcs={nc} odd_deg={odd} broken={broken} foreign_vertices={nforeign} topology_splits={splits} ({time.time()-t0:.1f}s)')
    st['border_vertices'] = len(st['border_vertices'])
    st['arcs'] = len(arcs)
    return arcs, prefs, st

def write_output(arcs, prefs, st, tol_m, out_path, min_ring_m=0.0, retrieved=''):
    poly = [enc_polyline(a) for a in arcs]
    delta = [enc_delta(a) for a in arcs]
    sz_poly = len(json.dumps(poly, ensure_ascii=False, separators=(',', ':')).encode('utf-8'))
    sz_delta = len(json.dumps(delta, separators=(',', ':')).encode('utf-8'))
    use_poly = sz_poly <= sz_delta
    log(f'arc encoding: polyline5={sz_poly} bytes, delta-int={sz_delta} bytes → {"polyline5" if use_poly else "delta"}')
    doc = {'v': 1,
           'source': f'国土数値情報 行政区域データ N03 {EDITION}版 (国土交通省) {DATASET_PAGE} (zip: {URL.format(nn="NN")})',
           'retrieved': retrieved,
           'license': 'CC BY 4.0 (国土数値情報ダウンロードサービス 利用規約)',
           'attribution': ATTRIBUTION,
           'attribution_short': ATTRIBUTION_SHORT,
           'generated': datetime.date.today().isoformat(),
           'tool': 'tools/pref/make-pref-borders.py',
           'quant': 1e-5,
           'coast_tolerance_m': tol_m,
           'min_ring_m': min_ring_m,
           'arcFormat': 'polyline5' if use_poly else 'delta',
           'arcFormatNote': ('各アークはGoogle Encoded Polyline(精度1e-5, lat,lng順)の文字列' if use_poly else
                             '各アークは [x0,y0,dx1,dy1,...] の1e-5度整数(経度が先)'),
           'ringNote': 'rings の各要素はアーク番号の列。負の値 ~i (= -i-1) は i 番のアークを逆向きに辿る。隣り合うアークは端点を共有し、最後は最初の点に戻る。穴の区別はなく偶奇規則で内外を判定する',
           'topologyNote': '海岸線の間引きは、弦と元の海岸線で囲む領域に他県の頂点が入らないように分け直してある(県の多角形どうしは重ならない。tools/pref/verify-pref-borders.js の overlap が 0)',
           'stats': {k: st[k] for k in ('border_vertices', 'coast_vertices_raw', 'coast_vertices_simplified', 'arcs', 'border_arcs', 'coast_arcs', 'rings', 'dropped_small_rings', 'topology_splits', 'foreign_vertices')},
           'arcs': poly if use_poly else delta,
           'prefs': prefs}
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, 'w', encoding='utf-8') as fh:
        json.dump(doc, fh, ensure_ascii=False, separators=(',', ':'))
    return os.path.getsize(out_path), sz_poly, sz_delta

def main():
    global LOG
    ap = argparse.ArgumentParser()
    ap.add_argument('--work', default=os.path.join(os.environ.get('TMPDIR', '/tmp'), 'pref-borders'))
    ap.add_argument('--tol', type=float, default=500.0)
    ap.add_argument('--max-mb', type=float, default=3.0)
    ap.add_argument('--min-ring-m', type=float, default=50.0)
    ap.add_argument('--prefs', default=','.join(f'{i:02d}' for i in range(1, 48)))
    ap.add_argument('--keep-dl', action='store_true')
    ap.add_argument('--out', default=OUT)
    a = ap.parse_args()
    os.makedirs(a.work, exist_ok=True)
    LOG = open(os.path.join(a.work, 'run.log'), 'a', encoding='utf-8')
    codes = [c.strip() for c in a.prefs.split(',') if c.strip()]
    t0 = time.time()
    log(f'start: prefs={len(codes)} tol={a.tol}m min_ring={a.min_ring_m}m work={a.work}')
    metas = pass1(codes, a.work, a.keep_dl)
    log(f'pass1 done ({time.time()-t0:.0f}s): vertices_raw={sum(m["vertices_raw"] for m in metas.values())} outline_edges={sum(m["outline_edges"] for m in metas.values())}')
    pairs = border_pairs(codes, metas, a.work)
    nbe = sum(len(v) for v in pairs.values())
    log(f'border pairs: {len(pairs)} pairs, {nbe} shared edges ({time.time()-t0:.0f}s)')
    edir = os.path.join(a.work, 'edges')
    mt = max((os.path.getmtime(os.path.join(edir, f)) for f in os.listdir(edir) if f.endswith('.bin')), default=time.time())
    retrieved = datetime.date.fromtimestamp(mt).isoformat()   # 取得日=輪郭辺のキャッシュを作った日(zipを落とした日)
    tol = a.tol
    result = None
    while True:
        arcs, prefs, st = pass2(codes, metas, pairs, a.work, tol, a.min_ring_m)
        size, sp, sd = write_output(arcs, prefs, st, tol, a.out, a.min_ring_m, retrieved)
        log(f'wrote {a.out}: {size} bytes (tol={tol}m) stats={json.dumps(st, ensure_ascii=False)}')
        result = {'tol_m': tol, 'min_ring_m': a.min_ring_m, 'bytes': size, 'bytes_polyline': sp, 'bytes_delta': sd, 'stats': st, 'elapsed_s': round(time.time() - t0)}
        json.dump(result, open(os.path.join(a.work, f'result-{int(tol)}-{int(a.min_ring_m)}.json'), 'w'), ensure_ascii=False)
        if size <= a.max_mb * 1024 * 1024 or tol >= 1000:
            break
        log(f'size {size} > {a.max_mb} MB → coast tolerance {tol} → {tol*2} m')
        tol *= 2
    log(f'done in {time.time()-t0:.0f}s')
    print(json.dumps(result, ensure_ascii=False))

if __name__ == '__main__':
    main()

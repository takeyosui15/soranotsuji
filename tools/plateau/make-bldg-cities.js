#!/usr/bin/env node
// NAME
//   make-bldg-cities.js — PLATEAU建築物モデルの全国対応表 data/plateau-bldg-cities.json の生成
// SYNOPSIS
//   NODE_USE_ENV_PROXY=1 node tools/plateau/make-bldg-cities.js [ローカルのplateau-datasets.json]
//   (プロキシ環境ではNODE_USE_ENV_PROXY=1が必要。引数を省略するとカタログAPIから取得)
// DESCRIPTION
//   宙の窓の都市モード(PLATEAU建物レイヤ。デッサン06のPLATEAU節)が参照する静的対応表を生成する。
//   カタログAPI(plateau-datasets)から建築物モデル(3D Tiles)を都市ファミリ(id前置部)毎に集約し、
//   LOD1/LOD2無テクスチャ/LOD2テクスチャ付きのtileset URLと、tileset rootのregion実測から
//   bbox[西,南,東,北 度]を得る。毎セッション9MBのカタログを引かないための「静的表をリポジトリに持つ」
//   方式(第50ラウンドの未決事項の解=第51ラウンド)。
// OUTPUT
//   data/plateau-bldg-cities.json — { generated, source, base, cities: [{code,name,bbox,lod1,lod2NoTex,lod2Tex}] }
//   URLはbase(assets.cms.plateau.reearth.io/assets/)からの相対。異なるホストの場合のみ絶対URLで格納。
// HISTORY
//   第51ラウンドで作成(PoCの静的2区表からの全国化)。
const fs = require('fs');
const path = require('path');

const CATALOG_URL = 'https://api.plateauview.mlit.go.jp/datacatalog/plateau-datasets';
const ASSET_BASE = 'https://assets.cms.plateau.reearth.io/assets/';
const CONCURRENCY = 6;

async function getCatalog() {
    if (process.argv[2]) return JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
    const r = await fetch(CATALOG_URL);
    if (!r.ok) throw new Error('catalog ' + r.status);
    return r.json();
}

(async () => {
    const cat = await getCatalog();
    const bldg = cat.datasets.filter(d => d.type_en === 'bldg' && d.format === '3D Tiles' && d.url);
    // 都市ファミリ毎に変種を集約(idの「_lodN…」より前が鍵。例: 13104_bldg)
    const fams = new Map();
    let skippedLod = 0;
    for (const d of bldg) {
        const key = d.id.replace(/_lod\d.*$/, '');
        let f = fams.get(key);
        if (!f) {
            f = { code: d.ward_code || d.city_code, name: (d.ward ? d.city + d.ward : d.city), pref: d.pref, vars: {} };
            fams.set(key, f);
        }
        if (d.lod === '1' && !d.url.includes('no_texture')) f.vars.lod1 = d.url;
        else if (d.lod === '2' && d.texture === false) f.vars.lod2NoTex = d.url;
        else if (d.lod === '2' && d.texture === true) f.vars.lod2Tex = d.url;
        else skippedLod++;   // LOD3/4等は当面使わない(将来の楽しみ)
    }
    console.log(`建築物モデル ${bldg.length}件 → 都市ファミリ ${fams.size}件 (LOD3/4等スキップ ${skippedLod}件)`);

    // bboxは「表示に使い得る変種のうち最小のtileset」(LOD1優先)のroot regionから
    const jobs = [...fams.entries()];
    const cities = [];
    const failures = [];
    let done = 0;
    async function worker() {
        while (jobs.length) {
            const [key, f] = jobs.shift();
            const src = f.vars.lod1 || f.vars.lod2NoTex || f.vars.lod2Tex;
            if (!src) { failures.push(key + ': 変種なし'); continue; }
            let bbox = null;
            for (let t = 0; t < 3 && !bbox; t++) {
                try {
                    const r = await fetch(src);
                    if (!r.ok) throw new Error('HTTP ' + r.status);
                    const rg = (await r.json()).root.boundingVolume.region;
                    const deg = (v) => Math.round(v * 180 / Math.PI * 1e4) / 1e4;
                    bbox = [deg(rg[0]), deg(rg[1]), deg(rg[2]), deg(rg[3])];
                } catch (e) { if (t === 2) failures.push(`${key}: ${e.message}`); else await new Promise(r => setTimeout(r, 1500 * (t + 1))); }
            }
            if (!bbox) continue;
            const rel = (u) => u ? (u.startsWith(ASSET_BASE) ? u.slice(ASSET_BASE.length) : u) : undefined;
            cities.push({ code: f.code, name: f.name, bbox,
                          lod1: rel(f.vars.lod1), lod2NoTex: rel(f.vars.lod2NoTex), lod2Tex: rel(f.vars.lod2Tex) });
            if (++done % 50 === 0) console.log(`  bbox取得 ${done}/${fams.size}`);
        }
    }
    await Promise.all(new Array(CONCURRENCY).fill(0).map(worker));
    cities.sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : a.name.localeCompare(b.name)));

    // 診断: 同一コードの重複(政令市の全体+区の併存など、二重描画の芽)を目視できるように
    const byCode = new Map();
    for (const c of cities) byCode.set(c.code, (byCode.get(c.code) || 0) + 1);
    const dup = [...byCode.entries()].filter(([, n]) => n > 1);
    if (dup.length) console.log('注意: 同一コードの複数エントリ:', dup.map(([c, n]) => `${c}×${n}`).join(', '));

    const out = {
        generated: new Date().toISOString().slice(0, 10),
        source: CATALOG_URL,
        base: ASSET_BASE,
        cities,
    };
    const dst = path.join(__dirname, '..', '..', 'data', 'plateau-bldg-cities.json');
    fs.writeFileSync(dst, JSON.stringify(out));
    const st = { lod1: 0, lod2NoTex: 0, lod2Tex: 0 };
    cities.forEach(c => { if (c.lod1) st.lod1++; if (c.lod2NoTex) st.lod2NoTex++; if (c.lod2Tex) st.lod2Tex++; });
    console.log(`wrote ${dst}: ${cities.length}都市 ${(fs.statSync(dst).size / 1024).toFixed(1)}KB`);
    console.log(`  変種: lod1=${st.lod1} lod2NoTex=${st.lod2NoTex} lod2Tex=${st.lod2Tex}`);
    if (failures.length) console.log(`  取得失敗 ${failures.length}件:`, failures.slice(0, 8).join(' / '));
})().catch(e => { console.error(e); process.exit(1); });

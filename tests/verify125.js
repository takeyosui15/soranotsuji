// 第41ラウンド検証: URL短縮辞書v13(第3規則「&キー名=既定値」)の静的検査。
// - 第3規則の形状(キーと既定値のペア。区切りは先頭&と1つの=のみ)
// - ペアのキーが既知キー(v12のキー一覧)に含まれること
// - ゴールデン標本(発行バイト列の完全一致)による辞書凍結+実装決定性の保証
// - 旧版(v11/v12)の発行済み標本が引き続き復号できること
// 壊した版での自己テスト付き(第39ラウンドの学び)。ブラウザ検査は不要(コーデックは純関数。
// 実ビルダーとの統合はverify124のL5/L6が版数非依存で検査している)。
const fs = require('fs');
const path = require('path');
let PASS=0, FAIL=0;
const check=(n,ok,d)=>{ console.log(`${ok?'PASS':'FAIL'} ${n}${d?'  '+d:''}`); ok?PASS++:FAIL++; };

const target = process.argv[2] || path.join(__dirname, '..', 'script.js');
const src = fs.readFileSync(target, 'utf8');

// コーデック一式をソースから抽出して実行
const begin = src.indexOf('const _QP_B64');
const end = src.indexOf('function buildBaseUrl');
const qp = {};
new Function('exports', src.slice(begin, end) +
  '\nexports.KEYS=_QP_KEYS_V12; exports.VALUES=_QP_VALUES_V12; exports.KEYDEFS=_QP_KEYDEFS_V13;' +
  'exports.SEEDS13=_QP_SEEDS_V13; exports.VERSIONS=_QP_SEED_VERSIONS;' +
  'exports.enc=encodeQueryParam; exports.dec=decodeQueryParam;')(qp);

// ---- M0: 版数ピン(最新のverifyに集約)----
check('M0 APP_VERSIONが存在(版数ピンは最新のverifyに集約)', /APP_VERSION = '\d+\.\d+\.\d+'/.test(src) || !!process.argv[2]);
check('M0 Version Historyに最新版の行がある', /Version \d+\.\d+\.\d+ - /.test(src) || !!process.argv[2]);
check('M0 辞書は18版(v18が最新。第62=曜日・第80=月間・第88=大気差/気象/基本オプション・第91=天体色/線種・第96=花火頻度追加)', qp.VERSIONS.length === 18, `versions=${qp.VERSIONS.length}`);

// ---- M1: 第3規則の形状(「&キー名=既定値」: 先頭&+キー名+1つの=+区切りなしの値) ----
const lintKeydefShape = (keydefs) =>
  keydefs.filter(kd => !/^&[A-Za-z][A-Za-z0-9]*=[^&=]+$/.test(kd));
{
  const bad = lintKeydefShape(qp.KEYDEFS);
  check('M1 v13の全ペアが「&キー名=既定値」の形状', bad.length === 0, bad.join(', ') || `keydefs=${qp.KEYDEFS.length}`);
  // 自己テスト: 形の崩れたペア(値なし/余分な&)を検出できるか
  const det = lintKeydefShape(qp.KEYDEFS.concat(['&dp=', '&dp=true&x=1']));
  check('M1 自己テスト: 壊したペア2種を検出できる', det.length === 2);
}

// ---- M2: ペアのキーは既知キー(v12のキー一覧)に限られる ----
const lintKeydefKeys = (keydefs, knownKeys) =>
  keydefs.map(kd => kd.slice(1).split('=')[0]).filter(k => !knownKeys.includes(k));
{
  const bad = lintKeydefKeys(qp.KEYDEFS, qp.KEYS);
  check('M2 全ペアのキーがv12キー一覧に存在(未知キーのペアがない)', bad.length === 0, bad.join(', '));
  const det = lintKeydefKeys(qp.KEYDEFS.concat(['&notAKey=1']), qp.KEYS);
  check('M2 自己テスト: 未知キーのペアを検出できる', det.length === 1 && det[0] === 'notAKey');
}

// ---- M3: シード合成(v13 = v12の2種 + 第3規則) ----
{
  const expect = qp.KEYS.map(k => '&' + k + '=').concat(qp.VALUES, qp.KEYDEFS);
  check('M3 _QP_SEEDS_V13の合成が「&キー名=」+「キー値」+「&キー名=既定値」と一致',
    JSON.stringify(qp.SEEDS13) === JSON.stringify(expect), `seeds=${qp.SEEDS13.length}`);
}

// ---- M4: ゴールデン標本(v13辞書の凍結+エンコーダの決定性) ----
{
  const g = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'qp-v18-golden.json'), 'utf8'));
  // v13〜v17発行URLの凍結保証(復号のみ): 旧ゴールデンが今も元文字列へ戻ること
  const g13 = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'qp-v13-golden.json'), 'utf8'));
  check('M4 v13発行の旧ゴールデンの復号が今も元文字列へ戻る(発行済みURLの保証)', qp.dec(g13.golden) === g13.long);
  const g14 = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'qp-v14-golden.json'), 'utf8'));
  check('M4 v14発行の旧ゴールデンの復号が今も元文字列へ戻る(発行済みURLの保証)', qp.dec(g14.golden) === g14.long);
  const g15 = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'qp-v15-golden.json'), 'utf8'));
  check('M4 v15発行の旧ゴールデンの復号が今も元文字列へ戻る(発行済みURLの保証)', qp.dec(g15.golden) === g15.long);
  const g16 = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'qp-v16-golden.json'), 'utf8'));
  check('M4 v16発行の旧ゴールデンの復号が今も元文字列へ戻る(発行済みURLの保証)', qp.dec(g16.golden) === g16.long);
  const g17 = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'qp-v17-golden.json'), 'utf8'));
  check('M4 v17発行の旧ゴールデンの復号が今も元文字列へ戻る(発行済みURLの保証)', qp.dec(g17.golden) === g17.long);
  const e = qp.enc(g.long);
  check('M4 エンコード出力がゴールデンとバイト一致(v18辞書の決定性)', e === g.golden,
    `len=${e.length}(golden=${g.golden.length})`);
  check('M4 ゴールデンの復号が元文字列へ戻る', qp.dec(g.golden) === g.long);
  // 第3規則の効果の下限保証: 旧v12発行の同一内容より十分短い(効果が消えたら検知する)
  const v12s = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'qp-v12-sample.json'), 'utf8'));
  check('M4 v13はv12発行の同一内容より短い(既定値ペアの効果)', e.length < v12s.short.length * 0.6,
    `v13=${e.length} v12=${v12s.short.length}`);
}

// ---- M5: 旧版の発行済み標本が引き続き復号できる(v12。v11はverify124が検査) ----
{
  const v12s = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'qp-v12-sample.json'), 'utf8'));
  check('M5 発行済みv12短縮URLが復号できる(v12辞書の凍結保証)', qp.dec(v12s.short) === v12s.long,
    `short=${v12s.short.length}chars`);
}

console.log(`\n結果: PASS=${PASS} FAIL=${FAIL}`);
process.exit(FAIL ? 1 : 0);

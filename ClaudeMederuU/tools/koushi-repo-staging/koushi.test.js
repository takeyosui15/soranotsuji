/**
 * @name        koushi.test.js — koushi.jsのゴールデンテスト
 * @synopsis    node ClaudeMederuU/tools/koushi.test.js            (検証: ゴールデンと突き合わせ)
 *              node ClaudeMederuU/tools/koushi.test.js --update   (ゴールデン再生成: 出力を目視確認してから使う)
 * @description 入力(Koushi記法)→期待HTMLの標本を koushi-golden.json に凍結して突き合わせる
 *              (宙の辻の辞書ゴールデンと同じ作法)。標本の更新は仕様の変更時のみ・目視確認とセットで。
 *              構造チェック: style属性を出さないこと(class出力のみ)・番号無視(番号違いで出力同一)。
 * @history     第45ラウンド(2026-07-25) 初版。
 * @seeAlso     koushi.js, koushi-golden.json, ClaudeMederuU/dessin/01-koushi-dessin.md
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { koushiToHtml, renderMarkdownKoushi } = require('./koushi.js');

const GOLDEN_PATH = path.join(__dirname, 'koushi-golden.json');

// ---- 標本の入力(デッサン01の実例が中心) ----------------------------------------

const CASES = [
  {
    name: 'basic-3x2',
    input: [
      '- t:1.',
      '  - r:1.',
      '    - c:1. A1',
      '    - c:2. B1',
      '    - c:3. C1',
      '  - r:2.',
      '    - c:1. A2',
      '    - c:2. B2',
      '    - c:3. C2',
    ].join('\n'),
  },
  {
    name: 'spans-sample',
    input: [
      '- t:2.',
      '  - r:1.',
      '    - c:1:xc2. A1-B1',
      '    - c:3:xr2. C1-C2',
      '  - r:2.',
      '    - c:1:xr2. A2-A3',
      '    - c:2. B2',
      '  - r:3.',
      '    - c:2:xc2. B3-C3',
    ].join('\n'),
  },
  {
    name: 'combined-attrs',
    input: [
      '- t:1.',
      '  - r:1.',
      '    - c:1:xc2:c:m. 結合+中央寄せ',
      '    - c:3:r:b. 右下寄せ',
    ].join('\n'),
  },
  {
    name: 'headers',
    input: [
      '- t:1.',
      '  - r:1:h.',
      '    - c:1. 見出しA',
      '    - c:2. 見出しB',
      '  - r:2.',
      '    - c:1:h. 行見出し',
      '    - c:2. 値',
    ].join('\n'),
  },
  {
    name: 'multiline-content',
    input: [
      '- t:3.',
      '  - r:1.',
      '    - c:1.',
      '      - 1行目の内容',
      '      - 2行目の内容',
      '        - 要素にMarkdownが書ける',
      '    - c:2. B1',
    ].join('\n'),
  },
  {
    name: 'nested-table',
    input: [
      '- t:3.',
      '  - r:2.',
      '    - c:1.',
      '      - t:4.',
      '        - r:1.',
      '          - c:1. 入れ子のテーブル',
      '    - c:2. B2',
    ].join('\n'),
  },
  {
    name: 'inputs-all-22',
    input: [
      '- t:1.',
      '  - r:1.',
      '    - c:1.',
      '      - btn:"クリックしてね".',
      '      - chb.',
      '      - chb:on.',
      '      - clr:"#ff0000".',
      '      - dat:"2017-06-01".',
      '      - dtl:"2017-06-01T08:30".',
      '      - eml:"sophie@example.com".',
      '      - fil:multiple.',
      '      - hdn:"34657".',
      '      - img:"https://www.example.com/login.png".',
      '      - mnt:"2001-06".',
      '      - nmb:"42".',
      '      - pwd.',
      '      - rad:on.',
      '      - rng:"90".',
      '      - rst:"フォームをリセット".',
      '      - sch.',
      '      - smt:"リクエストを送信".',
      '      - tel:"123-4567-8901".',
      '      - txt:"小文字で一語で".',
      '      - tim:"13:30".',
      '      - url:"http://www.example.com".',
      '      - wek:"2017-W01".',
    ].join('\n'),
  },
  {
    name: 'escaping',
    input: [
      '- t:1.',
      '  - r:1.',
      '    - c:1. <script>alert("x")</script> & 山括弧',
      '    - c:2.',
      '      - btn:"値に\\"引用符\\"と<記号>".',
    ].join('\n'),
  },
  {
    name: 'checklist-with-states',
    input: [
      '- t:1.',
      '  - r:1:h.',
      '    - c:1. 済',
      '    - c:2. 項目',
      '  - r:2.',
      '    - c:1:c.',
      '      - chb:on.',
      '    - c:2. ハーネス構築',
      '  - r:3.',
      '    - c:1:c.',
      '      - chb.',
      '    - c:2. 回帰実行',
    ].join('\n'),
  },
  {
    // 罫線属性(第67ラウンド): 行=上辺(trのclass)・セル=左辺(td/thのclass)。bd=二重/bs=太実線/ba=破線/bo=点線。
    // 寄せ等の既存classとの併記も検査する(c:2:c:bd → class="k-c k-bd")
    name: 'borders-row-cell',
    input: [
      '- t:1.',
      '  - r:1:h.',
      '    - c:1. 状態',
      '    - c:2:bd. グループA',
      '    - c:3:ba. グループB',
      '  - r:2:bd.',
      '    - c:1. S1',
      '    - c:2:c:bd. a',
      '    - c:3:bo. b',
      '  - r:3:ba.',
      '    - c:1. S2',
      '    - c:2:bs. c',
      '    - c:3. d',
    ].join('\n'),
  },
];

const MD_CASE = {
  name: 'markdown-fence',
  input: [
    '# 見出し',
    '',
    '前の文章。',
    '',
    '```koushi',
    '- t:1.',
    '  - r:1.',
    '    - c:1. A1',
    '```',
    '',
    '後の文章。',
  ].join('\n'),
};

// ---- 実行 ----------------------------------------------------------------------

let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) { pass++; console.log('  PASS ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail ? '\n' + detail : '')); }
}

const actual = {};
for (const c of CASES) actual[c.name] = koushiToHtml(c.input);
actual[MD_CASE.name] = renderMarkdownKoushi(MD_CASE.input);

if (process.argv.includes('--update')) {
  fs.writeFileSync(GOLDEN_PATH, JSON.stringify(actual, null, 2) + '\n');
  console.log('golden updated: ' + GOLDEN_PATH + ' (目視確認してからコミットすること)');
  process.exit(0);
}

console.log('== koushi.test — ゴールデン突き合わせ ==');
const golden = JSON.parse(fs.readFileSync(GOLDEN_PATH, 'utf8'));

// G1..: 各標本の一致
for (const name of Object.keys(golden)) {
  const ok = actual[name] === golden[name];
  check('golden:' + name, ok, ok ? '' : '--- expected ---\n' + golden[name] + '\n--- actual ---\n' + actual[name]);
}

// S1: style属性を出さない(class出力のみ=構造とスタイルの分離)
check('no-style-attr', Object.values(actual).every(h => !/style=/.test(h)));

// S2: 番号は描画時に無視(番号を振り直しても出力が同一)
const renumbered = CASES[0].input.replace(/c:\d+/g, 'c:9').replace(/r:\d+/g, 'r:7').replace(/t:\d+/g, 't:5');
check('numbers-ignored', koushiToHtml(renumbered) === actual['basic-3x2']);

// S3: 未知の属性は読み飛ばす(前方互換: 壊れず・出力にも漏れない)
const future = koushiToHtml('- t:1.\n  - r:1.\n    - c:1:zz9:c. A1');
check('unknown-attr-forward-compat', future.includes('class="k-c"') && !future.includes('zz9'));

console.log('---');
console.log('PASS: ' + pass + ' / FAIL: ' + fail);
process.exit(fail ? 1 : 0);

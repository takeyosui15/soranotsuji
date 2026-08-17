/**
 * @name        anchor.test.js — anchor.jsの検証(性質テスト+実物スモーク)
 * @synopsis    node ClaudeMederuU/tools/anchor.test.js
 * @description ゴールデンではなく性質(不変条件)で検証する: 整形・コメントに不変/改名に敏感/
 *              文字列・テンプレート・正規表現内の波括弧を数えない/Merkleの伝播/重複検出。
 *              仕上げに実物(宙の辻script.js)を読ませて木が組めることを確認する。
 * @history     第45ラウンド(2026-07-25) 初版。
 * @seeAlso     anchor.js, ClaudeMederuU/dessin/03-anchor-dessin.md
 */
'use strict';
const path = require('path');
const fs = require('fs');
const { parseBraceTree, normalize, fingerprint, listNodes } = require('./anchor.js');

let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) { pass++; console.log('  PASS ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail ? ' — ' + detail : '')); }
}
function fpsOf(src) { return listNodes(src, parseBraceTree(src)); }

console.log('== anchor.test — 性質テスト ==');

// A1: 木の形(入れ子の関数が親子になる)
{
  const src = 'function outer(){ function inner(){ return 1; } return inner(); }';
  const tree = parseBraceTree(src);
  check('A1 tree-shape', tree.children.length === 1 && tree.children[0].children.length === 1 &&
    /function outer\(\)/.test(tree.children[0].label) && /function inner\(\)/.test(tree.children[0].children[0].label));
}

// A2: 整形(空白・改行)に不変
{
  const a = fpsOf('function f(a,b){return a+b;}')[0].fp;
  const b = fpsOf('function f(a, b) {\n  return a + b;\n}')[0].fp;
  check('A2 whitespace-invariant', a === b);
}

// A3: コメントに不変
{
  const a = fpsOf('function f(){return 1;}')[0].fp;
  const b = fpsOf('function f(){/* コメント */return 1; // 行末\n}')[0].fp;
  check('A3 comment-invariant', a === b);
}

// A4: 改名に敏感(変数名は吸収しない=第45ラウンド決定)
{
  const a = fpsOf('function f(){return aa+1;}')[0].fp;
  const b = fpsOf('function f(){return ab+1;}')[0].fp;
  check('A4 rename-detected', a !== b);
}

// A5: 単語の境界は保つ(varとxの間の空白を消してvarxにしない)
{
  const a = normalize('var x = 1');
  check('A5 word-boundary', a === 'var x=1', 'got: ' + a);
}

// A6: 文字列の中の波括弧は数えない
{
  const src = 'const s = "}{"; if (a) { x(); }';
  const nodes = fpsOf(src);
  check('A6 string-braces', nodes.length === 1);
}

// A7: テンプレートと${式}の中のオブジェクトリテラル(入れ子込み)
{
  const src = 'const t = `x${ ({a:1}).a }y${ `in${z}` }`; if (q) { w(); }';
  const nodes = fpsOf(src);
  check('A7 template-expr', nodes.length === 2, 'nodes=' + nodes.length); // {a:1} と if{}
}

// A8: 正規表現の中の波括弧(量指定子)は数えない・除算と区別する
{
  const src = 'const r = /a{2,3}/.test(s); const d = n / 2; if (r) { y(); }';
  const nodes = fpsOf(src);
  check('A8 regex-braces', nodes.length === 1, 'nodes=' + nodes.length);
}

// A9: 重複検出(同じ本体は同じ指紋)
{
  const src = 'function a(x){ return x*2+1; } function b(y){ return y*2+1; }';
  const nodes = fpsOf(src);
  check('A9 dup-same-body', nodes.length === 2 && nodes[0].fp !== nodes[1].fp,
    '本体が違う(仮引数名が違う)ので別指紋のはず');
  const src2 = 'function a(x){ return x*2+1; } function b(x){ return x*2+1; }';
  const nodes2 = fpsOf(src2);
  check('A9b dup-detected', nodes2[0].fp === nodes2[1].fp);
}

// A10: Merkleの伝播(子の変更が親の指紋を変える)
{
  const p1 = fpsOf('function o(){ function i(){ return 1; } }');
  const p2 = fpsOf('function o(){ function i(){ return 2; } }');
  check('A10 merkle-propagation', p1[0].fp !== p2[0].fp && p1[1].fp !== p2[1].fp);
}

// A11: 対応の取れない波括弧はthrow(黙って続けない)
{
  let threw = false;
  try { parseBraceTree('function f(){ '); } catch (e) { threw = true; }
  let threw2 = false;
  try { parseBraceTree('} extra'); } catch (e) { threw2 = true; }
  check('A11 unbalanced-throws', threw && threw2);
}

// A12: 実物スモーク(宙の辻 script.js を読んで木が組める)
{
  const src = fs.readFileSync(path.join(__dirname, '..', '..', 'script.js'), 'utf8');
  let nodes = null, err = '';
  try { nodes = listNodes(src, parseBraceTree(src)); } catch (e) { err = e.message; }
  check('A12 script.js-parses', !!nodes && nodes.length > 500, err || ('nodes=' + (nodes && nodes.length)));
  if (nodes) {
    const groups = new Map();
    for (const e of nodes) { if (e.size >= 60) groups.set(e.fp, (groups.get(e.fp) || 0) + 1); }
    const dups = [...groups.values()].filter(n => n >= 2).length;
    console.log('  info: script.js nodes=' + nodes.length + ' / 60ch以上の重複グループ=' + dups);
    check('A13 deterministic', JSON.stringify(nodes.map(e => e.fp)) === JSON.stringify(listNodes(src, parseBraceTree(src)).map(e => e.fp)));
  }
}

console.log('---');
console.log('PASS: ' + pass + ' / FAIL: ' + fail);
process.exit(fail ? 1 : 0);

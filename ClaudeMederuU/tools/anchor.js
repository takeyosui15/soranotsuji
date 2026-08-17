/**
 * @name        anchor.js — 構造指紋の発行・検証・重複検出(第1版: コア)
 * @synopsis    node ClaudeMederuU/tools/anchor.js print  <file.js> [--min-size N]   (発行: 木+指紋の一覧)
 *              node ClaudeMederuU/tools/anchor.js dup    <file.js> [--min-size N]   (検出: 同一指紋の部分木=重複コード)
 *              node ClaudeMederuU/tools/anchor.js verify <file.js> <指紋...>        (検証: 不変/書き換わり)
 *              const { parseBraceTree, fingerprint, listNodes } = require('./anchor');
 * @description JSソースを波括弧の入れ子木として読み、各ノード(={…}部分木)の構造指紋を発行する。
 *              デッサン ClaudeMederuU/dessin/03-anchor-dessin.md が正。要点:
 *              - 構造指紋 = 正規化した部分木テキスト({…}含む)のsha256。表示は先頭8桁(Gitの短縮に倣う)。
 *              - 正規化v1 = コメント除去+空白の畳み込み(単語文字同士の間だけ1個の空白を残す)。
 *                変数名は吸収しない(第45ラウンド決定)。規則を変える時は版を上げる(発行済み指紋の意味は変えない)。
 *              - 字句を理解して数える: 文字列・テンプレート(${}の入れ子込み)・コメント・正規表現の中の
 *                波括弧は数えない(正規表現の量指定子{2,3}等)。
 *              - 同一指紋の部分木の列挙=重複コード検出(リファクタリングBの道具と一石二鳥)。
 * @history     第45ラウンド(2026-07-25) 初版(進め方③の実装第1歩・依頼者GO)。台帳の候補から昇格。
 *              PAD記法との連携(指紋の書き込み・ref:)は指紋書式の確定後(dessin/02第45節)。
 * @seeAlso     ClaudeMederuU/dessin/03-anchor-dessin.md, ClaudeMederuU/tools/anchor.test.js,
 *              ClaudeMederuU/tools/README.md(台帳)
 */
'use strict';
const crypto = require('crypto');

// ---- 字句走査: コード/コメント/文字列/テンプレート/正規表現を見分けて波括弧の木を作る ----

// 直前の意味のあるトークンがこれらなら、次の `/` は除算ではなく正規表現の開始(慣用のヒューリスティック)
const REGEX_PRECEDERS = new Set([
  '(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '<', '>', '^', '~',
  'return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'case', 'do', 'else', 'yield', 'await',
]);

function isWordChar(ch) { return /[A-Za-z0-9_$]/.test(ch); }

/**
 * JSテキストを波括弧の入れ子木にする。
 * 返り値: { children: [node...] } / node = { label, start, end, line, children }
 * start/endは'{'/'}'のインデックス。labelは直前の文境界から'{'までの正規化テキスト(末尾80文字)。
 * 対応の取れない'}'や閉じ忘れがあれば throw(構造指紋の土台なので黙って続けない)。
 */
function parseBraceTree(src) {
  const root = { label: '(root)', start: -1, end: src.length, line: 0, children: [] };
  const stack = [root];
  // ctx: 'code'のほか、テンプレート式(`${…}`)の入れ子を追うためのスタック
  const ctxStack = [];
  let mode = 'code';
  let prevToken = '';      // 直前の意味のあるトークン(正規表現ヒューリスティック用)
  let wordBuf = '';
  let boundary = 0;        // 直前の文境界(; { })の次の位置 = ラベルの開始
  let parenDepth = 0;
  let line = 1;

  function flushWord() { if (wordBuf) { prevToken = wordBuf; wordBuf = ''; } }

  for (let i = 0; i < src.length; i++) {
    const ch = src[i], next = src[i + 1];
    if (ch === '\n') line++;

    if (mode === 'lineComment') { if (ch === '\n') mode = 'code'; continue; }
    if (mode === 'blockComment') { if (ch === '*' && next === '/') { mode = 'code'; i++; } continue; }
    if (mode === 'sq') { if (ch === '\\') i++; else if (ch === "'") mode = 'code'; continue; }
    if (mode === 'dq') { if (ch === '\\') i++; else if (ch === '"') mode = 'code'; continue; }
    if (mode === 'tpl') {
      if (ch === '\\') { i++; continue; }
      if (ch === '$' && next === '{') { ctxStack.push({ type: 'expr', depth: stack.length }); mode = 'code'; i++; continue; }
      if (ch === '`') { mode = 'code'; continue; }
      continue;
    }
    if (mode === 'regex') {
      if (ch === '\\') i++;
      else if (ch === '[') mode = 'regexClass';
      else if (ch === '/') { mode = 'code'; prevToken = '/regex/'; }
      continue;
    }
    if (mode === 'regexClass') { if (ch === '\\') i++; else if (ch === ']') mode = 'regex'; continue; }

    // ---- code ----
    if (ch === '/' && next === '/') { flushWord(); mode = 'lineComment'; i++; continue; }
    if (ch === '/' && next === '*') { flushWord(); mode = 'blockComment'; i++; continue; }
    if (ch === "'") { flushWord(); mode = 'sq'; prevToken = "'str'"; continue; }
    if (ch === '"') { flushWord(); mode = 'dq'; prevToken = "'str'"; continue; }
    if (ch === '`') { flushWord(); mode = 'tpl'; prevToken = "'str'"; continue; }
    if (ch === '/') {
      flushWord();
      if (prevToken === '' || REGEX_PRECEDERS.has(prevToken)) { mode = 'regex'; continue; }
      prevToken = '/'; continue;
    }
    if (isWordChar(ch)) { wordBuf += ch; continue; }
    flushWord();
    if (/\s/.test(ch)) continue;

    if (ch === '(') parenDepth++;
    else if (ch === ')') parenDepth--;
    else if (ch === '{') {
      const label = normalize(src.slice(boundary, i)).trim().slice(-80) || '(block)';
      const node = { label, start: i, end: -1, line, children: [] };
      stack[stack.length - 1].children.push(node);
      stack.push(node);
      boundary = i + 1;
      prevToken = '{';
      continue;
    } else if (ch === '}') {
      const top = ctxStack[ctxStack.length - 1];
      if (top && top.type === 'expr' && stack.length === top.depth) {
        // テンプレート式 `${…}` の閉じ。木のノードではない
        ctxStack.pop(); mode = 'tpl'; continue;
      }
      if (stack.length === 1) throw new Error('unbalanced } at line ' + line);
      const node = stack.pop();
      node.end = i;
      boundary = i + 1;
      prevToken = '}';
      continue;
    } else if (ch === ';' && parenDepth === 0) {
      boundary = i + 1;
    }
    prevToken = ch;
  }
  if (stack.length !== 1) throw new Error('unclosed { (depth ' + (stack.length - 1) + ' at EOF)');
  if (mode !== 'code' && mode !== 'lineComment') throw new Error('unterminated ' + mode + ' at EOF');
  return root;
}

// ---- 正規化v1とハッシュ ------------------------------------------------------

/** コメント除去+空白畳み込み(単語文字に挟まれた空白だけ1個残す)。規則を変える時は版を上げる */
function normalize(codeText) {
  // コメント・文字列を字句として尊重するため、簡易走査で除去する(文字列の中身は保持)
  let out = '';
  let mode = 'code';
  for (let i = 0; i < codeText.length; i++) {
    const ch = codeText[i], next = codeText[i + 1];
    if (mode === 'lineComment') { if (ch === '\n') { mode = 'code'; out += '\n'; } continue; }
    if (mode === 'blockComment') { if (ch === '*' && next === '/') { mode = 'code'; i++; } continue; }
    if (mode === 'sq') { out += ch; if (ch === '\\') { out += next; i++; } else if (ch === "'") mode = 'code'; continue; }
    if (mode === 'dq') { out += ch; if (ch === '\\') { out += next; i++; } else if (ch === '"') mode = 'code'; continue; }
    if (mode === 'tpl') { out += ch; if (ch === '\\') { out += next; i++; } else if (ch === '`') mode = 'code'; continue; }
    if (ch === '/' && next === '/') { mode = 'lineComment'; i++; continue; }
    if (ch === '/' && next === '*') { mode = 'blockComment'; i++; continue; }
    if (ch === "'") { mode = 'sq'; out += ch; continue; }
    if (ch === '"') { mode = 'dq'; out += ch; continue; }
    if (ch === '`') { mode = 'tpl'; out += ch; continue; }
    out += ch;
  }
  // 空白の畳み込み: 単語文字同士の間だけ1個の空白、それ以外の空白は削除
  let s = '';
  for (let i = 0; i < out.length; i++) {
    const ch = out[i];
    if (!/\s/.test(ch)) { s += ch; continue; }
    let j = i;
    while (j < out.length && /\s/.test(out[j])) j++;
    const prev = s[s.length - 1], after = out[j];
    if (prev && after && isWordChar(prev) && isWordChar(after)) s += ' ';
    i = j - 1;
  }
  return s;
}

/** ノードの構造指紋 = 正規化した部分木テキスト({…}含む)のsha256(hex) */
function fingerprint(src, node) {
  return crypto.createHash('sha256').update(normalize(src.slice(node.start, node.end + 1))).digest('hex');
}

/** 木を平らにして[{node, fp, size, path}]を返す(sizeは生テキスト長) */
function listNodes(src, tree) {
  const out = [];
  (function walk(node, depth) {
    for (const c of node.children) {
      out.push({ node: c, fp: fingerprint(src, c), size: c.end - c.start + 1, depth });
      walk(c, depth + 1);
    }
  })(tree, 0);
  return out;
}

// ---- CLI ---------------------------------------------------------------------

function main() {
  const fs = require('fs');
  const [cmd, file, ...rest] = process.argv.slice(2);
  if (!cmd || !file) {
    console.error('usage: node anchor.js print|dup|verify <file.js> [--min-size N | 指紋...]');
    process.exit(1);
  }
  const src = fs.readFileSync(file, 'utf8');
  const tree = parseBraceTree(src);
  const all = listNodes(src, tree);
  const minIdx = rest.indexOf('--min-size');
  const minSize = minIdx >= 0 ? +rest[minIdx + 1] : (cmd === 'dup' ? 60 : 0);

  if (cmd === 'print') {
    for (const e of all) {
      if (e.size < minSize) continue;
      console.log('  '.repeat(e.depth) + '#' + e.fp.slice(0, 8) + ' L' + e.node.line + ' (' + e.size + 'ch) ' + e.node.label);
    }
    console.log('nodes: ' + all.length);
  } else if (cmd === 'dup') {
    const groups = new Map();
    for (const e of all) {
      if (e.size < minSize) continue;
      if (!groups.has(e.fp)) groups.set(e.fp, []);
      groups.get(e.fp).push(e);
    }
    const dups = [...groups.values()].filter(g => g.length >= 2).sort((a, b) => b[0].size - a[0].size);
    for (const g of dups) {
      console.log('#' + g[0].fp.slice(0, 8) + ' ×' + g.length + ' (' + g[0].size + 'ch)');
      for (const e of g) console.log('  L' + e.node.line + ' ' + e.node.label);
    }
    console.log('duplicate groups: ' + dups.length + ' (min-size ' + minSize + 'ch。親が重複なら子も重複として出る)');
  } else if (cmd === 'verify') {
    const fps = rest.filter(a => /^#?[0-9a-f]{8,64}$/.test(a)).map(a => a.replace(/^#/, ''));
    if (!fps.length) { console.error('verify: 指紋(8〜64桁hex)を1つ以上'); process.exit(1); }
    let missing = 0;
    for (const want of fps) {
      const hit = all.find(e => e.fp.startsWith(want));
      if (hit) console.log('不変     #' + want + ' -> L' + hit.node.line + ' ' + hit.node.label);
      else { console.log('書き換わり #' + want + ' (現在の木に見つからない)'); missing++; }
    }
    process.exit(missing ? 2 : 0);
  } else {
    console.error('unknown command: ' + cmd);
    process.exit(1);
  }
}

module.exports = { parseBraceTree, normalize, fingerprint, listNodes };
if (require.main === module) main();

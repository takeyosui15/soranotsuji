/**
 * @name        koushi.js — Koushi(格子)記法 → HTML 片方向レンダラ
 * @synopsis    const { koushiToHtml, renderMarkdownKoushi } = require('./koushi');
 *              koushiToHtml(blockText)        -> '<table class="koushi">…</table>'
 *              renderMarkdownKoushi(mdText)   -> Markdown中の```koushiフェンスを<table>へ置換した文字列
 *              CLI: node ClaudeMederuU/tools/koushi.js <file.md>   (置換結果を標準出力へ)
 * @description Markdownの箇条書きで書いた表(結合セル・入れ子・input要素つき)をHTMLへ描く。
 *              記法はデッサン ClaudeMederuU/dessin/01-koushi-dessin.md が正。要点:
 *              - 3層 t:/r:/c: + `.`終端。`:`区切りの属性は順不同(xc2/xr2=スパン、l/c/r/t/m/b=寄せ、h=見出し)。
 *              - 番号属性は描画時に無視する(依頼者決定・編集のしやすさ優先)。
 *              - input要素は3文字トークン22種(chb:on. など)。値は`"`括り(エスケープは\"のみ)。
 *              - スタイルはclass出力のみ(k-l/k-c/k-r/k-t/k-m/k-b)。style属性は出さない(CSS任せ)。
 *              - セルの子: 素の行=行(div.k-line)、行の子=リスト(ul/li)、t:=入れ子テーブル、inputトークン=input。
 *              依存なし・Node/ブラウザ両用。検証はゴールデン方式(koushi.test.js + koushi-golden.json)。
 * @history     第45ラウンド(2026-07-25) 初版。進め方②の実装(デッサン01のレンダラ計画)。
 * @seeAlso     ClaudeMederuU/dessin/01-koushi-dessin.md, ClaudeMederuU/tools/koushi.test.js,
 *              ClaudeMederuU/tools/README.md(台帳)
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) { module.exports = factory(); }
  else { root.Koushi = factory(); }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---- 字句: トークン行の解析 -------------------------------------------------

  // Koushiの構造トークン + input 3文字トークン22種(デッサン01の一覧が正)
  const STRUCT_HEADS = ['t', 'r', 'c'];
  const INPUT_HEADS = {
    btn: { type: 'button', val: 'value' },
    chb: { type: 'checkbox', val: 'check' },
    clr: { type: 'color', val: 'value' },
    dat: { type: 'date', val: 'value' },
    dtl: { type: 'datetime-local', val: 'value' },
    eml: { type: 'email', val: 'placeholder' },
    fil: { type: 'file', val: 'flag' },
    hdn: { type: 'hidden', val: 'value' },
    img: { type: 'image', val: 'src' },
    mnt: { type: 'month', val: 'value' },
    nmb: { type: 'number', val: 'value' },
    pwd: { type: 'password', val: 'value' },
    rad: { type: 'radio', val: 'check' },
    rng: { type: 'range', val: 'value' },
    rst: { type: 'reset', val: 'value' },
    sch: { type: 'search', val: 'value' },
    smt: { type: 'submit', val: 'value' },
    tel: { type: 'tel', val: 'placeholder' },
    txt: { type: 'text', val: 'placeholder' },
    tim: { type: 'time', val: 'value' },
    url: { type: 'url', val: 'placeholder' },
    wek: { type: 'week', val: 'value' },
  };

  /**
   * 1行のテキストをトークンとして読む。トークンでなければnull(=素の内容行)。
   * 文法: head(:attr)*. 内容   / attrは bare(次の:か.まで) または "…"(\"エスケープ可)
   */
  function parseToken(text) {
    const m = /^([a-z]{1,3})(?=[:.])/.exec(text);
    if (!m) return null;
    const head = m[1];
    if (STRUCT_HEADS.indexOf(head) < 0 && !INPUT_HEADS[head]) return null;
    let pos = head.length;
    const attrs = [];
    while (text[pos] === ':') {
      pos++;
      if (text[pos] === '"') {
        pos++;
        let s = '';
        while (pos < text.length) {
          if (text[pos] === '\\' && text[pos + 1] === '"') { s += '"'; pos += 2; continue; }
          if (text[pos] === '"') { pos++; break; }
          s += text[pos++];
        }
        attrs.push({ str: s });
      } else {
        let s = '';
        while (pos < text.length && text[pos] !== ':' && text[pos] !== '.') s += text[pos++];
        attrs.push(s);
      }
    }
    if (text[pos] !== '.') return null; // `.`終端が無ければトークンとみなさない
    pos++;
    let content = text.slice(pos);
    if (content[0] === ' ') content = content.slice(1);
    return { head, attrs, content };
  }

  // ---- 構文: 箇条書き → 木 ----------------------------------------------------

  /** 箇条書きテキストを {text, children} の木(仮想ルートの子配列)にする */
  function parseBullets(blockText) {
    const root = { depth: -1, children: [] };
    const stack = [root];
    const lines = blockText.split('\n');
    for (const line of lines) {
      const m = /^(\s*)[-*+]\s+(.*)$/.exec(line);
      if (!m) continue; // 空行・箇条書き以外は読み飛ばす(v1)
      const depth = m[1].length;
      const node = { depth, text: m[2], children: [] };
      while (stack.length > 1 && stack[stack.length - 1].depth >= depth) stack.pop();
      stack[stack.length - 1].children.push(node);
      stack.push(node);
    }
    return root.children;
  }

  // ---- 描画: 木 → HTML --------------------------------------------------------

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /** セル/行の属性を読む(番号は無視、xc/xr=スパン、1文字=寄せ、h=見出し、b?=罫線)。
   *  罫線属性(第67ラウンド・デッサン01): bd=二重・bs=太実線・ba=破線・bo=点線。
   *  行(r:)に付けるとその行の上辺、セル(c:)に付けるとそのセルの左辺の罫線になる(CSS側の規則)。 */
  function readAttrs(attrs) {
    const out = { colspan: 0, rowspan: 0, classes: [], borders: [], header: false };
    for (const a of attrs) {
      if (typeof a !== 'string') continue; // "…"属性は構造トークンでは使わない(v1)
      if (/^\d+$/.test(a)) continue;       // 番号は描画時に無視(依頼者決定)
      let m;
      if ((m = /^x([cr])(\d+)$/.exec(a))) {
        if (m[1] === 'c') out.colspan = +m[2]; else out.rowspan = +m[2];
      } else if (a === 'h') {
        out.header = true;
      } else if (/^[lcrtmb]$/.test(a)) {
        out.classes.push('k-' + a);
      } else if (/^b[dsao]$/.test(a)) {
        out.borders.push('k-' + a);
      }
      // 未知の属性は読み飛ばす(前方互換: 将来の属性で古いレンダラが壊れないように)
    }
    return out;
  }

  /** inputトークン → <input … /> */
  function renderInput(tok) {
    const def = INPUT_HEADS[tok.head];
    const parts = ['type="' + def.type + '"'];
    const a0 = tok.attrs[0];
    if (def.val === 'check') {
      if (a0 === 'on') parts.push('checked');
    } else if (def.val === 'flag') {
      if (a0 === 'multiple') parts.push('multiple');
    } else if (a0 && typeof a0 === 'object') {
      parts.push(def.val + '="' + esc(a0.str) + '"');
    }
    return '<input ' + parts.join(' ') + ' />';
  }

  /** セルの内容の子(テキスト行・リスト・入れ子t:・input)を行配列へ描く */
  function renderContentNodes(nodes, indent) {
    const out = [];
    for (const n of nodes) {
      const tok = parseToken(n.text);
      if (tok && tok.head === 't') {
        out.push.apply(out, renderTable(tok, n.children, indent));
      } else if (tok && INPUT_HEADS[tok.head]) {
        out.push(indent + renderInput(tok));
      } else {
        let line = indent + '<div class="k-line">' + esc(n.text);
        if (n.children.length) line += renderListCompact(n.children);
        out.push(line + '</div>');
      }
    }
    return out;
  }

  /** 行の子リスト(ul/li)は1行に畳んで描く(セル内の深い入れ子は稀のため) */
  function renderListCompact(nodes) {
    let s = '<ul>';
    for (const n of nodes) {
      const tok = parseToken(n.text);
      let body = tok && INPUT_HEADS[tok.head] ? renderInput(tok) : esc(n.text);
      if (n.children.length) body += renderListCompact(n.children);
      s += '<li>' + body + '</li>';
    }
    return s + '</ul>';
  }

  /** t:ノード → <table>行配列 */
  function renderTable(tok, rowNodes, indent) {
    const out = [indent + '<table class="koushi">'];
    for (const rn of rowNodes) {
      const rtok = parseToken(rn.text);
      if (!rtok || rtok.head !== 'r') continue; // t:直下はr:のみ(それ以外は読み飛ばす)
      const rAttrs = readAttrs(rtok.attrs);
      // 行の罫線属性はtrのclassに出す(その行の上辺。寄せ等は従来どおりセル側のみ)
      out.push(indent + (rAttrs.borders.length ? '  <tr class="' + rAttrs.borders.join(' ') + '">' : '  <tr>'));
      for (const cn of rn.children) {
        const ctok = parseToken(cn.text);
        if (!ctok || ctok.head !== 'c') continue;
        const cAttrs = readAttrs(ctok.attrs);
        const tag = (rAttrs.header || cAttrs.header) ? 'th' : 'td';
        const cls = cAttrs.classes.concat(cAttrs.borders);   // セルの罫線属性は左辺(classでCSSへ)
        let open = '<' + tag;
        if (cAttrs.colspan) open += ' colspan="' + cAttrs.colspan + '"';
        if (cAttrs.rowspan) open += ' rowspan="' + cAttrs.rowspan + '"';
        if (cls.length) open += ' class="' + cls.join(' ') + '"';
        open += '>';
        const inline = ctok.content ? esc(ctok.content) : '';
        if (!cn.children.length) {
          out.push(indent + '    ' + open + inline + '</' + tag + '>');
        } else {
          out.push(indent + '    ' + open);
          if (inline) out.push(indent + '      ' + inline);
          out.push.apply(out, renderContentNodes(cn.children, indent + '      '));
          out.push(indent + '    </' + tag + '>');
        }
      }
      out.push(indent + '  </tr>');
    }
    out.push(indent + '</table>');
    return out;
  }

  /** Koushiブロック(箇条書きテキスト) → HTML。t:が複数あれば順に並べる */
  function koushiToHtml(blockText) {
    const tops = parseBullets(blockText);
    const out = [];
    for (const n of tops) {
      const tok = parseToken(n.text);
      if (tok && tok.head === 't') out.push.apply(out, renderTable(tok, n.children, ''));
    }
    return out.join('\n');
  }

  /** Markdown中の```koushiフェンスを<table>へ置換する */
  function renderMarkdownKoushi(mdText) {
    return mdText.replace(/```koushi[ \t]*\n([\s\S]*?)```/g, function (_, body) {
      return koushiToHtml(body);
    });
  }

  return { koushiToHtml, renderMarkdownKoushi, parseToken, parseBullets };
}));

// CLI: node koushi.js <file.md> — 置換結果を標準出力へ
if (typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module) {
  const fs = require('fs');
  const file = process.argv[2];
  if (!file) { console.error('usage: node koushi.js <file.md>'); process.exit(1); }
  process.stdout.write(module.exports.renderMarkdownKoushi(fs.readFileSync(file, 'utf8')));
}

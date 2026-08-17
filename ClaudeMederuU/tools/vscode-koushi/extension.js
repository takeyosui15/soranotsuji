/**
 * @name        vscode-koushi/extension.js — Koushi Preview拡張の本体
 * @synopsis    VSCodeが起動時にactivate()を呼び、extendMarkdownIt(md)で標準Markdownプレビューの
 *              markdown-itへフェンス描画を差し込む。```koushi フェンスだけを koushiToHtml で表にし、
 *              それ以外のフェンスは元の描画へ委譲する(他言語のハイライト等は一切変えない)。
 * @description - レンダラは同梱の koushi.js(正は ClaudeMederuU/tools/koushi.js。コピーの同期は
 *                extension.test.js のドリフト検査が見張る)。
 *              - 描画に失敗した場合はエラーメッセージを<pre>で出し、プレビュー全体は壊さない。
 *              - VSCode API(vscode モジュール)には依存しない(markdown-it連携だけの拡張)。
 * @history     第66ラウンド(2026-08-09) 初版(依頼者GO: 回答その63の設計通り)。
 * @seeAlso     package.json(contributes.markdown.markdownItPlugins), koushi-preview.css,
 *              ClaudeMederuU/dessin/01-koushi-dessin.md, ClaudeMederuU/tools/README.md(台帳)
 */
'use strict';
const Koushi = require('./koushi.js');

/** フェンスのinfo文字列(```の直後)がkoushiかどうか(空白・属性つきの表記も許す) */
function isKoushiFence(info) {
    return ((info || '').trim().split(/\s+/)[0] || '').toLowerCase() === 'koushi';
}

/** markdown-itへフェンス描画を差し込む(元のfence描画を保持して委譲する) */
function extendMarkdownIt(md) {
    const defaultFence = md.renderer.rules.fence ||
        ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options));
    md.renderer.rules.fence = (tokens, idx, options, env, self) => {
        const token = tokens[idx];
        if (isKoushiFence(token.info)) {
            try {
                return Koushi.koushiToHtml(token.content) + '\n';
            } catch (e) {
                const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
                return '<pre class="koushi-error">Koushi描画エラー: ' + esc(e && e.message ? e.message : e) + '</pre>\n';
            }
        }
        return defaultFence(tokens, idx, options, env, self);
    };
    return md;
}

exports.activate = function () {
    return { extendMarkdownIt };
};

// テスト用(VSCode外のNodeから直接検証できるように公開する)
exports.extendMarkdownIt = extendMarkdownIt;
exports.isKoushiFence = isKoushiFence;

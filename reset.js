// 宙の辻 データ管理ページ(reset.html)のスクリプト。インラインから外部ファイルにしてあるのは CSP(script-src 'self') のため。
// HTMLエスケープ処理（安全に表示するため）
function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, function(tag) {
        const charsToReplace = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        };
        return charsToReplace[tag] || tag;
    });
}

// ローカルストレージの使用容量を表示する関数 (UTF-16なので1文字=2バイトで概算)
function renderStorageUsage() {
    let bytes = 0;
    for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        bytes += (k.length + (localStorage.getItem(k) || '').length) * 2;
    }
    const kb = bytes / 1024;
    document.getElementById('storageUsage').textContent =
        `ローカルストレージ使用容量: ${kb.toLocaleString('ja-JP', { maximumFractionDigits: 1 })}KB（${localStorage.length}項目）`;
}

// ローカルストレージの中身を取得して画面に表示する関数
function renderStorageData() {
    const displayArea = document.getElementById('dataDisplay');
    const clearBtn = document.getElementById('clearBtn');
    renderStorageUsage();

    // データが空の場合
    if (localStorage.length === 0) {
        displayArea.innerHTML = '<p class="empty-message">✓ 現在、保存されているデータはありません。</p>';
        clearBtn.disabled = true; // ボタンを押せなくする
        return;
    }

    // データがある場合はテーブルを作成
    let tableHTML = '<table><tr><th>キー (変数名)</th><th>値 (データ内容)</th></tr>';
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const value = localStorage.getItem(key);
        tableHTML += `<tr><td>${escapeHTML(key)}</td><td>${escapeHTML(value)}</td></tr>`;
    }
    tableHTML += '</table>';
    
    displayArea.innerHTML = tableHTML;
    clearBtn.disabled = false;
}

// ページ読み込み時に実行
window.addEventListener('DOMContentLoaded', renderStorageData);

// クリアボタンが押された時の処理
document.getElementById('clearBtn').addEventListener('click', function() {
    // ユーザーに最終確認
    if (confirm('本当にすべてのデータを消去してもよろしいですか？\nこの操作は元に戻せません。')) {
        // ローカルストレージを全クリア
        localStorage.clear();
        // IndexedDB(可視マップの資産と標高タイル・天気のキャッシュ・地図タイルの控え)も消去する(宙の辻に関わる端末内のデータを全て空にする)
        for (const name of ['soranotsuji-kashimap', 'soranotsuji-wx', 'soranotsuji-maptiles']) {   // 地図タイルの控えの店(soranotsuji-maptiles)も消す
            try { indexedDB.deleteDatabase(name); } catch (e) { /* 対応していないブラウザは無視 */ }
        }
        
        // 画面を更新して空になったことを示す
        renderStorageData();
        
        // 完了メッセージを表示
        const statusMsg = document.getElementById('statusMessage');
        statusMsg.textContent = 'データをすべて消去しました。';
        statusMsg.style.color = '#27ae60'; // 緑色に変更
    }
});

// ファイル名用の日時文字列
function fileStamp() {
    const d = new Date();
    const p = n => ('0' + n).slice(-2);
    return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

// バックアップ: soranotsuji_プレフィックスのlocalStorageを {キー:値} のJSONにしてダウンロード
// (第39ラウンド: 本体のバックアップ/Googleドライブ保存と同一形式・同一の絞り込みに統一。
//  同一オリジンの他アプリのキーを混入させない)
document.getElementById('backupBtn').addEventListener('click', function() {
    if (localStorage.length === 0) { alert('保存されているデータがありません。'); return; }
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('soranotsuji_')) data[k] = localStorage.getItem(k);
    }
    if (Object.keys(data).length === 0) { alert('宙の辻のデータ(soranotsuji_*)がありません。'); return; }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `soranotsuji-app-バックアップ-${fileStamp()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    const statusMsg = document.getElementById('statusMessage');
    statusMsg.textContent = 'バックアップ（JSON）をダウンロードしました。';
    statusMsg.style.color = '#27ae60';
});

// 復元: バックアップJSONを読み、各キーをlocalStorageへ書き戻す
document.getElementById('restoreBtn').addEventListener('click', function() {
    document.getElementById('restoreFile').click();
});
document.getElementById('restoreFile').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(ev) {
        try {
            const data = JSON.parse(ev.target.result);
            if (typeof data !== 'object' || data === null || Array.isArray(data)) throw new Error('バックアップの形式が不正です');
            if (!confirm('バックアップの内容で現在のデータを上書きします。よろしいですか？')) return;
            // soranotsuji_キーのみ書き戻す(混入した無関係キーは無視=復元で掃除される。第39ラウンド)
            // 書き戻すのはアプリの保存キー(soranotsuji_app)だけ・JSONとして読める物だけ・4M文字まで(知らない鍵や巨大な値を植え付けられないように)
            const v = data['soranotsuji_app'];
            if (typeof v !== 'string') throw new Error('バックアップに soranotsuji_app がありません');
            if (v.length > 4 * 1024 * 1024) throw new Error('バックアップが大きすぎます(' + (v.length / 1048576).toFixed(1) + 'M文字)');
            JSON.parse(v);
            localStorage.setItem('soranotsuji_app', v);
            renderStorageData();
            const statusMsg = document.getElementById('statusMessage');
            statusMsg.textContent = 'バックアップから復元しました。';
            statusMsg.style.color = '#27ae60';
        } catch (err) {
            alert('復元に失敗しました: ' + err.message);
        }
    };
    reader.readAsText(file);
    e.target.value = '';
});

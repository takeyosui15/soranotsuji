/*
宙の辻 - Sora no Tsuji
Copyright (C) 2026 Takeyoshi Watanabe (Sora no Tsuji Project)

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.
*/

// ============================================================
// スプレッドシート UIメニュー
// ============================================================

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('ログ管理')
    .addItem('新規ログシート作成', 'createNewLogSheets')
    .addToUi();
}

// ============================================================
// Web API エントリーポイント
// ============================================================

function doGet(e) {
  var lock = LockService.getScriptLock();
  var hasLock = lock.tryLock(10000);

  if (!hasLock) {
    return ContentService.createTextOutput(JSON.stringify({ error: 'lock_busy' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var action = e.parameter.action;
    var now = new Date();
    var todayStr = getDateString(now);
    var currentYear = now.getFullYear();
    var lastYear = currentYear - 1;

    // 今年のシートを取得
    var sheet = ss.getSheetByName(String(currentYear));
    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify({ error: 'no_sheet' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 新規訪問の場合、カウントアップ
    if (action === 'visit') {
      var rowIndex = findDateRow(sheet, todayStr);
      if (rowIndex !== -1) {
        var currentVal = sheet.getRange(rowIndex, 2).getValue();
        sheet.getRange(rowIndex, 2).setValue(currentVal + 1);
      }
    }

    // 集計値を取得
    var stats = getStats(ss, sheet, todayStr, currentYear, lastYear);

    // action=detail の場合のみ日別データを含める
    if (action === 'detail') {
      stats.dailyLog = getDailyLog(sheet);
      var lastSheet = ss.getSheetByName(String(lastYear));
      stats.lastYearLog = lastSheet ? getDailyLog(lastSheet) : [];
    }

    return ContentService.createTextOutput(JSON.stringify(stats))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (e) {
    return ContentService.createTextOutput(JSON.stringify({ error: e.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

// ============================================================
// データ取得ヘルパー
// ============================================================

function getDateString(dateObj) {
  return Utilities.formatDate(dateObj, 'Asia/Tokyo', 'yyyy-MM-dd');
}

/**
 * シート内で指定日付の行番号を返す（1始まり）。見つからなければ -1。
 * データ行は3行目=1月1日から日順に1行ずつ並ぶ規約(createNewLogSheets)なので、
 * 年初からの日数で行番号を直接求める（全行ループしない＝第78ラウンド）。
 * 求めた行の日付だけ1セル検証し、合わない場合のみ従来の全行走査へフォールバックする
 * （手動で行を挿入・削除したシートへの保険）。
 */
function findDateRow(sheet, targetDateStr) {
  var p = targetDateStr.split('-');
  var y = parseInt(p[0], 10), m = parseInt(p[1], 10), d = parseInt(p[2], 10);
  // シート名=年の規約。年が違う日付はこのシートに無い(昨年分は呼び出し側が昨年シートで引き直す)
  if (String(y) !== sheet.getName()) return -1;
  // 年初からの日数(閏年もDate.UTCの日数差で正しく出る)→ 行番号(3行目=1月1日)
  var dayOfYear = Math.round((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 86400000) + 1;
  var row = dayOfYear + 2;
  if (row <= sheet.getLastRow()) {
    var cell = sheet.getRange(row, 1).getValue();
    if (cell instanceof Date && getDateString(cell) === targetDateStr) return row;
  }
  // フォールバック: 規約通りに並んでいないシートのみ従来の全行走査
  var data = sheet.getRange(3, 1, sheet.getLastRow() - 2, 1).getValues();
  for (var i = 0; i < data.length; i++) {
    if (data[i][0] instanceof Date) {
      if (getDateString(data[i][0]) === targetDateStr) return i + 3; // 3行目開始
    }
  }
  return -1;
}

/**
 * 集計値（today, yesterday, yearTotal, lastYearTotal）を返す。
 * yearTotal / lastYearTotal は B2セルの SUM関数の結果を使用。
 */
function getStats(ss, sheet, todayStr, currentYear, lastYear) {
  var todayCount = 0;
  var yesterdayCount = 0;

  // 今日の訪問者数
  var todayRow = findDateRow(sheet, todayStr);
  if (todayRow !== -1) {
    todayCount = sheet.getRange(todayRow, 2).getValue() || 0;
  }

  // 昨日の訪問者数
  var yesterday = new Date(todayStr);
  yesterday.setDate(yesterday.getDate() - 1);
  var yesterdayStr = getDateString(yesterday);

  // 昨日が今年のシートにある場合
  var yesterdayRow = findDateRow(sheet, yesterdayStr);
  if (yesterdayRow !== -1) {
    yesterdayCount = sheet.getRange(yesterdayRow, 2).getValue() || 0;
  } else {
    // 1月1日の場合、昨日は昨年シートにある
    var lastSheet = ss.getSheetByName(String(lastYear));
    if (lastSheet) {
      var lastYearRow = findDateRow(lastSheet, yesterdayStr);
      if (lastYearRow !== -1) {
        yesterdayCount = lastSheet.getRange(lastYearRow, 2).getValue() || 0;
      }
    }
  }

  // 年間集計: B2セルのSUM関数の結果
  var yearTotal = sheet.getRange(2, 2).getValue() || 0;

  // 昨年の年間集計
  var lastYearTotal = 0;
  var lastSheet = ss.getSheetByName(String(lastYear));
  if (lastSheet) {
    lastYearTotal = lastSheet.getRange(2, 2).getValue() || 0;
  }

  return {
    today: todayCount,
    yesterday: yesterdayCount,
    yearTotal: yearTotal,
    lastYearTotal: lastYearTotal
  };
}

/**
 * シートの全データ行（3行目〜）を日別ログとして返す。
 * action=detail のときのみ呼ばれる。
 */
function getDailyLog(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 3) return [];
  var data = sheet.getRange(3, 1, lastRow - 2, 2).getValues();
  var log = [];
  for (var i = 0; i < data.length; i++) {
    if (data[i][0] instanceof Date) {
      log.push({
        date: getDateString(data[i][0]),
        count: parseInt(data[i][1]) || 0
      });
    }
  }
  return log;
}

// ============================================================
// 新規ログシート作成
// ============================================================

/**
 * 「ログシート一覧」シートを参照して、新規ログシートを作成する。
 * スプレッドシートのUIメニューから呼び出される。
 */
function createNewLogSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var listSheet = ss.getSheetByName('ログシート一覧');
  if (!listSheet) {
    SpreadsheetApp.getUi().alert('「ログシート一覧」シートが見つかりません。');
    return;
  }

  var lastRow = listSheet.getLastRow();
  if (lastRow < 2) {
    SpreadsheetApp.getUi().alert('「ログシート一覧」シートにデータがありません。');
    return;
  }

  var data = listSheet.getRange(2, 1, lastRow - 1, 3).getValues();
  var createdCount = 0;

  for (var i = 0; i < data.length; i++) {
    var yearStr = String(data[i][0]).trim();
    if (!yearStr || isNaN(parseInt(yearStr))) continue;

    var year = parseInt(yearStr);
    var sheetName = String(year);
    var existingSheet = ss.getSheetByName(sheetName);
    var rowNum = i + 2; // ログシート一覧の行番号

    if (existingSheet) {
      // シートが存在する場合 → 状態を更新
      listSheet.getRange(rowNum, 2).setValue('済');
      var sumVal = existingSheet.getRange(2, 2).getValue() || 0;
      listSheet.getRange(rowNum, 3).setValue(sumVal >= 1 ? '済' : '未');
    } else {
      // シートが存在しない場合 → 新規作成
      var newSheet = ss.insertSheet(sheetName);

      // 閏年判定
      var isLeap = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
      var daysInYear = isLeap ? 366 : 365;

      // 一括書き込み用の配列を構築
      var rows = [];
      // 行1: 見出し
      rows.push(['日付', '訪問者数']);
      // 行2: 集計行
      rows.push(['', '=SUM(B3:B' + (2 + daysInYear) + ')']);
      // 行3〜: データ行
      var startDate = new Date(year, 0, 1); // 1月1日
      for (var d = 0; d < daysInYear; d++) {
        var date = new Date(startDate);
        date.setDate(startDate.getDate() + d);
        rows.push([date, 0]);
      }

      // 一括書き込み
      newSheet.getRange(1, 1, rows.length, 2).setValues(rows);

      // 日付列のフォーマット設定
      newSheet.getRange(3, 1, daysInYear, 1).setNumberFormat('yyyy/MM/dd');

      // 状態を更新
      listSheet.getRange(rowNum, 2).setValue('済');
      listSheet.getRange(rowNum, 3).setValue('未');

      createdCount++;
    }
  }

  SpreadsheetApp.getUi().alert(
    createdCount > 0
      ? createdCount + '件のログシートを作成しました。'
      : '新規作成が必要なシートはありませんでした。状態を更新しました。'
  );
}

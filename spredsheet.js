/*
宙の辻 - Sora no Tsuji
Copyright (c) 2026- Sora no Tsuji Project

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.
*/

function doGet(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000); // 同時アクセス対策

  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Log');
    var action = e.parameter.action;
    var todayStr = getDateString(new Date());
    
    var data = sheet.getDataRange().getValues();
    var rowIndex = -1;
    
    // 今日の日付の行を探す
    for (var i = 1; i < data.length; i++) {
      var d = getDateString(new Date(data[i][0]));
      if (d === todayStr) {
        rowIndex = i + 1; // 行番号は1始まり
        break;
      }
    }

    // 新規訪問の場合、カウントアップ
    if (action === 'visit') {
      if (rowIndex === -1) {
        sheet.appendRow([todayStr, 1]); // 新しい日
      } else {
        var currentVal = sheet.getRange(rowIndex, 2).getValue();
        sheet.getRange(rowIndex, 2).setValue(currentVal + 1);
      }
    }

    // データを再取得して集計
    var allData = sheet.getDataRange().getValues();
    var stats = calculateStats(allData, todayStr);
    
    return ContentService.createTextOutput(JSON.stringify(stats))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (e) {
    return ContentService.createTextOutput(JSON.stringify({error: e.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function getDateString(dateObj) {
  return Utilities.formatDate(dateObj, 'Asia/Tokyo', 'yyyy-MM-dd');
}

function calculateStats(data, todayStr) {
  var todayCount = 0;
  var yesterdayCount = 0;
  var yearTotal = 0;
  var lastYearTotal = 0;
  
  var today = new Date(todayStr);
  var yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  var yesterdayStr = getDateString(yesterday);
  var currentYear = today.getFullYear();
  var lastYear = currentYear - 1;

  var dailyLog = [];      // 今年のグラフ用データ
  var lastYearLog = [];   // ★追加: 去年のグラフ用データ

  for (var i = 1; i < data.length; i++) {
    var rowDate = new Date(data[i][0]);
    var rowDateStr = getDateString(rowDate);
    var count = parseInt(data[i][1]);
    var rowYear = rowDate.getFullYear();

    if (rowDateStr === todayStr) todayCount = count;
    if (rowDateStr === yesterdayStr) yesterdayCount = count;
    
    // 今年の処理
    if (rowYear === currentYear) {
      yearTotal += count;
      dailyLog.push({date: rowDateStr, count: count});
    }
    
    // 去年の処理
    if (rowYear === lastYear) {
      lastYearTotal += count;
      // ★追加: 去年のデータも配列に保存する
      lastYearLog.push({date: rowDateStr, count: count});
    }
  }

  return {
    today: todayCount,
    yesterday: yesterdayCount,
    yearTotal: yearTotal,
    lastYearTotal: lastYearTotal,
    dailyLog: dailyLog,       // 今年のデータ
    lastYearLog: lastYearLog  // ★追加: 去年のデータをJSONに含める
  };
}
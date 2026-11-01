/**
 * Service Flow Systems: collects /video-explanation watch data into a Google Sheet.
 *
 * Setup (2 minutes):
 *  1. Create a Google Sheet (name it e.g. "Video Watch Log"). Open Extensions > Apps Script.
 *  2. Paste this whole file over the default code and save.
 *  3. Deploy > New deployment > type "Web app". Execute as: Me. Who has access: Anyone. Deploy,
 *     approve the permissions, and copy the Web app URL (ends in /exec).
 *  4. Paste that URL into data-analytics-endpoint="" on the #vxPlayer div in video-explanation.html.
 *
 * Each viewer gets ONE row (matched on view_id). The page sends running totals as they watch, so the
 * row updates in place: seconds watched only ever goes up, and last_update shows when they left.
 */
var SHEET_NAME = 'Watches';
var HEADERS = [
  'view_id', 'date', 'time', 'timezone', 'seconds_watched', 'minutes_watched', 'percent_watched',
  'furthest_second', 'percent_reached', 'video_length', 'completed', 'plays', 'last_event',
  'last_update', 'device', 'page', 'referrer', 'user_agent'
];

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var d = JSON.parse(e.postData.contents);
    if (!d.view_id || !d.started_at) return out_('ignored');

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
    if (sh.getLastRow() === 0) {
      sh.appendRow(HEADERS);
      sh.setFrozenRows(1);
      sh.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
    }

    // find this viewer's row (newest rows are the most likely match, so search from the bottom)
    var last = sh.getLastRow();
    var row = 0;
    if (last > 1) {
      var ids = sh.getRange(2, 1, last - 1, 1).getValues();
      for (var i = ids.length - 1; i >= 0; i--) {
        if (ids[i][0] === d.view_id) { row = i + 2; break; }
      }
    }

    var prevSeconds = row ? Number(sh.getRange(row, 5).getValue()) || 0 : 0;
    var seconds = Math.max(prevSeconds, Number(d.seconds_watched) || 0);
    var line = [
      d.view_id, d.started_date, d.started_time, d.timezone,
      seconds, Math.round(seconds / 6) / 10, d.percent_watched,
      d.furthest_second, d.percent_reached, d.video_length, d.completed ? 'yes' : 'no', d.plays,
      d.event, new Date(), d.device, d.page, d.referrer, d.user_agent
    ];
    if (row) sh.getRange(row, 1, 1, line.length).setValues([line]);
    else sh.appendRow(line);
    return out_('ok');
  } catch (err) {
    return out_('error: ' + err);
  } finally {
    lock.releaseLock();
  }
}

// opening the URL in a browser just confirms it's deployed
function doGet() { return out_('video watch collector is live'); }

function out_(msg) {
  return ContentService.createTextOutput(msg).setMimeType(ContentService.MimeType.TEXT);
}

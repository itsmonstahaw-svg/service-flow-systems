/** @OnlyCurrentDoc */
/**
 * Service Flow Systems: collects /video-explanation watch data into a Google Sheet.
 *
 * Setup (2 minutes):
 *  1. Create a Google Sheet (name it e.g. "Video Watch Log"). Open Extensions > Apps Script.
 *  2. Paste this whole file over the default code and save.
 *  3. Deploy > New deployment > type "Web app". Execute as: Me. Who has access: Anyone. Deploy,
 *     approve the permissions, and copy the Web app URL (ends in /exec).
 *  4. Paste that URL into data-analytics-endpoint="" on the #vxPlayer div in video-explanation.html and
 *     video-explanation1.html.
 *
 * To see WHO watched, send each contact their own link with the GoHighLevel merge fields, e.g.
 *     https://serviceflowsystems.cloud/video-explanation?c={{contact.id}}&n={{contact.first_name}}&b={{contact.company_name}}
 * (keep b= last). The 'business' and 'contact_id' columns then fill in, and the 'By Business' tab rolls it up.
 *
 * Each viewer gets ONE row (matched on view_id). The page sends running totals as they watch, so the
 * row updates in place: seconds watched only ever goes up, and last_update shows when they left.
 */
var SHEET_NAME = 'Watches';
var HEADERS = [
  'view_id', 'business', 'contact_id', 'first_name', 'date', 'time', 'timezone', 'seconds_watched',
  'minutes_watched', 'percent_watched', 'furthest_second', 'percent_reached', 'video_length', 'completed',
  'plays', 'last_event', 'last_update', 'device', 'page', 'video_id', 'referrer', 'user_agent'
];
var SUMMARY_SHEET = 'By Business';

// GoHighLevel tagging: when a contact (link sent with ?c=<contact id>) passes 25 / 50 / 75 / 100% watched,
// they get the tags below, so a workflow can trigger on "Tag added". Needs one Script property
// (Project Settings > Script properties): GHL_TOKEN, a Private Integration token with the
// contacts.write scope. Without GHL_TOKEN the sheet logging works as before and nothing is tagged.
// Column W of the Watches sheet remembers the highest milestone already tagged for that view.
var GHL_MILESTONES = [[25, 'video-watched-25'], [50, 'video-watched-50'], [75, 'video-watched-75'], [100, 'video-watched-100']];
var GHL_COL = HEADERS.length + 1;

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

    // one row per business: how many times they watched, best watch %, last time they watched
    if (!ss.getSheetByName(SUMMARY_SHEET)) {
      var sum = ss.insertSheet(SUMMARY_SHEET);
      var q = "select B, C, count(A), max(J), max(L), max(Q) where C is not null group by B, C order by max(Q) desc " +
        "label B 'Business', C 'Contact ID', count(A) 'Views', max(J) 'Best % watched', max(L) 'Furthest %', max(Q) 'Last watched'";
      sum.getRange('A1').setFormula('=QUERY(Watches!A:V,"' + q + '",1)');
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

    var secCol = HEADERS.indexOf('seconds_watched') + 1;
    var prevSeconds = row ? Number(sh.getRange(row, secCol).getValue()) || 0 : 0;
    var seconds = Math.max(prevSeconds, Number(d.seconds_watched) || 0);
    var line = [
      d.view_id, d.business_name || '', d.contact_id || '', d.first_name || '',
      d.started_date, d.started_time, d.timezone,
      seconds, Math.round(seconds / 6) / 10, d.percent_watched,
      d.furthest_second, d.percent_reached, d.video_length, d.completed ? 'yes' : 'no', d.plays,
      d.event, new Date(), d.device, d.page, d.video_id || '', d.referrer, d.user_agent
    ];
    if (row) sh.getRange(row, 1, 1, line.length).setValues([line]);
    else { sh.appendRow(line); row = sh.getLastRow(); }

    tagMilestones_(sh, row, d);
    return out_('ok');
  } catch (err) {
    return out_('error: ' + err);
  } finally {
    lock.releaseLock();
  }
}

// adds the milestone tags in GoHighLevel the first time a contact passes each one
function tagMilestones_(sh, row, d) {
  try {
    var token = PropertiesService.getScriptProperties().getProperty('GHL_TOKEN');
    var contact = String(d.contact_id || '');
    if (!token || !/^[A-Za-z0-9]{10,40}$/.test(contact)) return;

    var pct = d.completed ? 100 : Number(d.percent_watched) || 0;
    var done = Number(sh.getRange(row, GHL_COL).getValue()) || 0;
    var tags = [];
    var reached = done;
    GHL_MILESTONES.forEach(function (m) {
      if (pct >= m[0] && m[0] > done) { tags.push(m[1]); reached = m[0]; }
    });
    if (!tags.length) return;

    var res = UrlFetchApp.fetch('https://services.leadconnectorhq.com/contacts/' + contact + '/tags', {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + token, Version: '2021-07-28' },
      payload: JSON.stringify({ tags: tags }),
      muteHttpExceptions: true
    });
    var code = res.getResponseCode();
    if (code >= 200 && code < 300) {
      if (sh.getRange(1, GHL_COL).getValue() !== 'ghl_milestone') sh.getRange(1, GHL_COL).setValue('ghl_milestone').setFontWeight('bold');
      sh.getRange(row, GHL_COL).setValue(reached);   // only recorded on success, so a failed call retries on the next update
    } else {
      console.error('GHL tag failed ' + code + ': ' + res.getContentText());
    }
  } catch (err) {
    console.error('GHL tag error: ' + err);
  }
}

// opening the URL in a browser just confirms it's deployed
function doGet() { return out_('video watch collector is live'); }

function out_(msg) {
  return ContentService.createTextOutput(msg).setMimeType(ContentService.MimeType.TEXT);
}

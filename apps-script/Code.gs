/**
 * Beat the Bot — picks back end (Google Apps Script).
 *
 * This script lives inside a Google Sheet that has a tab called "Picks" with these columns:
 *   submitted_at | player | round | match_id | home_score | away_score
 *
 * It does three things:
 *   1. Receive picks   (POST)            -> checks everything, then saves them
 *   2. "Who's in"      (GET ?action=whosin&round=4)  -> names + times only, never scores
 *   3. "Reveal picks"  (GET ?action=reveal&round=4)  -> all picks, but ONLY after the window closes
 *
 * The picks deadline is enforced HERE (not just on the website).
 */

// ===================== SETTINGS (the only part you might ever edit) =====================

// Your live website. The script reads data/rounds.json and data/fixtures.json from here.
var SITE_URL = 'https://testrugbyjk.github.io/beat-the-bot/';

// The six players. Names must match players.json exactly.
var PLAYERS = ['Adam', 'Matt', 'Jerome', 'Grigor', 'Angus', 'Alex'];

var SHEET_NAME = 'Picks';
var HEADERS = ['submitted_at', 'player', 'round', 'match_id', 'home_score', 'away_score'];
var CACHE_SECONDS = 600;   // remember the website's data for 10 minutes


// ===================== 1. RECEIVE PICKS (POST) =====================

function doPost(e) {
  try {
    var body;
    try {
      body = JSON.parse(e.postData.contents);
    } catch (err) {
      return reply_({ ok: false, message: 'Sorry, that did not look right. Please refresh the page and try again.' });
    }
    return reply_(savePicks_(body));
  } catch (err) {
    Logger.log('doPost error: ' + err);
    return reply_({ ok: false, message: 'Something went wrong on our side. Please try again in a minute.' });
  }
}

function savePicks_(body) {
  // --- Who is this? ---
  var player = canonicalPlayer_(body && body.player);
  if (!player) {
    return { ok: false, message: 'Please choose your name from the list.' };
  }

  // --- Which round, and is the window open right now? ---
  var round = findRound_(body.round);
  if (!round) {
    return { ok: false, message: 'We could not find that round.' };
  }
  var now = new Date().getTime();
  var opens = Date.parse(round.picks_open);
  var closes = Date.parse(round.picks_close);
  if (now < opens) {
    return { ok: false, message: 'Round ' + round.round + ' picks are not open yet. They open ' + niceTime_(opens) + ' (UK time).' };
  }
  if (now >= closes) {
    return { ok: false, message: 'Sorry, Round ' + round.round + ' picks closed on ' + niceTime_(closes) + ' (UK time).' };
  }

  // --- Is there exactly one pick for every match in the round? ---
  var picks = body.picks;
  if (!Array.isArray(picks)) {
    return { ok: false, message: 'No picks were received. Please fill in every match.' };
  }
  var wanted = matchIdsFor_(round);
  if (wanted.length === 0) {
    return { ok: false, message: 'Round ' + round.round + ' has no matches set up yet.' };
  }
  var seen = {};
  var rows = [];
  var submittedAt = new Date().toISOString();

  for (var i = 0; i < picks.length; i++) {
    var p = picks[i] || {};
    var id = String(p.match_id);
    if (wanted.indexOf(id) === -1) {
      return { ok: false, message: 'One of the matches (' + id + ') is not part of Round ' + round.round + '.' };
    }
    if (seen[id]) {
      return { ok: false, message: 'The same match appeared twice. Please refresh and try again.' };
    }
    var home = wholeScore_(p.home_score);
    var away = wholeScore_(p.away_score);
    if (home === null || away === null) {
      return { ok: false, message: 'Scores must be whole numbers from 0 to 99 (check ' + id + ').' };
    }
    seen[id] = true;
    rows.push([submittedAt, player, round.round, id, home, away]);
  }
  if (rows.length !== wanted.length) {
    return { ok: false, message: 'Please pick a score for every match — you gave ' + rows.length + ' of ' + wanted.length + '.' };
  }

  // --- Save, one person at a time (the lock stops two people clashing) ---
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) {
    return { ok: false, message: 'Lots of people are saving at once. Please press the button again in a few seconds.' };
  }
  try {
    var sheet = getSheet_();
    removePlayerRound_(sheet, player, round.round);   // resubmitting replaces earlier picks
    var firstEmptyRow = sheet.getLastRow() + 1;
    sheet.getRange(firstEmptyRow, 1, rows.length, HEADERS.length).setValues(rows);
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }

  return {
    ok: true,
    message: 'Nice one, ' + player + '! Your Round ' + round.round + ' picks are saved. You can change them any time before ' +
             niceTime_(closes) + ' (UK time).'
  };
}

// Delete any rows this player already saved for this round.
function removePlayerRound_(sheet, player, roundNumber) {
  var last = sheet.getLastRow();
  if (last < 2) return;
  var values = sheet.getRange(2, 1, last - 1, HEADERS.length).getValues();
  for (var i = values.length - 1; i >= 0; i--) {          // go from the bottom so row numbers stay correct
    if (values[i][1] === player && Number(values[i][2]) === roundNumber) {
      sheet.deleteRow(i + 2);
    }
  }
}


// ===================== 2 + 3. READING (GET) =====================

function doGet(e) {
  try {
    var params = (e && e.parameter) || {};
    var round = findRound_(params.round);
    if (!round) {
      return reply_({ ok: false, message: 'Please say which round, for example ?action=whosin&round=4' });
    }
    if (params.action === 'whosin') return reply_(whosIn_(round));
    if (params.action === 'reveal') return reply_(revealPicks_(round));
    return reply_({ ok: false, message: 'Unknown request. Use action=whosin or action=reveal.' });
  } catch (err) {
    Logger.log('doGet error: ' + err);
    return reply_({ ok: false, message: 'Something went wrong on our side. Please try again in a minute.' });
  }
}

// Who has submitted? Names and times only — never scores.
function whosIn_(round) {
  var latest = {};   // player -> most recent submitted_at
  readPicks_().forEach(function (r) {
    if (r.round !== round.round) return;
    if (!latest[r.player] || r.submitted_at > latest[r.player]) latest[r.player] = r.submitted_at;
  });
  var list = PLAYERS.filter(function (n) { return latest[n]; })
                    .map(function (n) { return { player: n, submitted_at: latest[n] }; });
  return { ok: true, round: round.round, submitted: list };
}

// Everyone's picks — but only once the window has closed.
function revealPicks_(round) {
  var closes = Date.parse(round.picks_close);
  if (new Date().getTime() < closes) {
    return { ok: false, message: 'No peeking! Picks stay secret until ' + niceTime_(closes) + ' (UK time).' };
  }
  var picks = readPicks_().filter(function (r) { return r.round === round.round; });
  return { ok: true, round: round.round, picks: picks };
}


// ===================== HELPERS =====================

// Reply to the website with JSON.
function reply_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// The "Picks" tab (created with its header row if it is missing).
function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  sheet.getRange('A:A').setNumberFormat('@');   // keep timestamps as plain text so Sheets does not reformat them
  return sheet;
}

// Every saved pick as a list of simple objects.
function readPicks_() {
  var sheet = getSheet_();
  var last = sheet.getLastRow();
  if (last < 2) return [];
  return sheet.getRange(2, 1, last - 1, HEADERS.length).getValues().map(function (r) {
    return {
      submitted_at: r[0] instanceof Date ? r[0].toISOString() : String(r[0]),
      player: String(r[1]),
      round: Number(r[2]),
      match_id: String(r[3]),
      home_score: Number(r[4]),
      away_score: Number(r[5])
    };
  });
}

// "adam " -> "Adam". Returns null if it is not one of the six.
function canonicalPlayer_(name) {
  var wanted = String(name === undefined || name === null ? '' : name).trim().toLowerCase();
  for (var i = 0; i < PLAYERS.length; i++) {
    if (PLAYERS[i].toLowerCase() === wanted) return PLAYERS[i];
  }
  return null;
}

// A whole number from 0 to 99 (numbers or digit-only text such as "24"), otherwise null.
function wholeScore_(value) {
  if (typeof value === 'string' && /^\d{1,2}$/.test(value.trim())) value = Number(value.trim());
  if (typeof value !== 'number' || !isFinite(value) || Math.floor(value) !== value) return null;
  if (value < 0 || value > 99) return null;
  return value;
}

// Look up a round (4, 5 or 6) in rounds.json from the website.
function findRound_(roundNumber) {
  var n = Number(roundNumber);
  if (!isFinite(n)) return null;
  var rounds = fetchSiteJson_('rounds').rounds;
  for (var i = 0; i < rounds.length; i++) {
    if (rounds[i].round === n) return rounds[i];
  }
  return null;
}

// The matches in a round: the ids listed in rounds.json that really exist in fixtures.json for that round.
function matchIdsFor_(round) {
  var fixtures = fetchSiteJson_('fixtures').fixtures;
  return round.match_ids.filter(function (id) {
    return fixtures.some(function (f) { return f.id === id && f.round === round.round; });
  });
}

// Read a JSON file from the live website, remembering it for 10 minutes.
function fetchSiteJson_(name) {
  var cache = CacheService.getScriptCache();
  var key = 'site_' + name;
  var cached = cache.get(key);
  if (cached) return JSON.parse(cached);

  var url = SITE_URL + 'data/' + name + '.json';
  var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (response.getResponseCode() !== 200) {
    throw new Error('Could not read ' + url + ' (status ' + response.getResponseCode() + ')');
  }
  var text = response.getContentText();
  cache.put(key, text, CACHE_SECONDS);
  return JSON.parse(text);
}

// "Thursday 5:00 PM" in UK time.
function niceTime_(millis) {
  return Utilities.formatDate(new Date(millis), 'Europe/London', 'EEEE d MMMM, h:mm a');
}


// ===================== TOOLS FOR YOU (run these from the editor) =====================

// Run this once to give the script permission, and to check it can read your website.
function testSetup() {
  var rounds = fetchSiteJson_('rounds').rounds;
  var fixtures = fetchSiteJson_('fixtures').fixtures;
  var sheet = getSheet_();
  Logger.log('All good! Read ' + rounds.length + ' rounds and ' + fixtures.length + ' fixtures from ' + SITE_URL);
  Logger.log('The "' + sheet.getName() + '" tab is ready.');
}

// Run this if you change the dates on the website and do not want to wait 10 minutes.
function clearCache() {
  CacheService.getScriptCache().removeAll(['site_rounds', 'site_fixtures']);
  Logger.log('Cache cleared.');
}

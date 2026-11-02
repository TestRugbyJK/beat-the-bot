// scoring.js — the scoring rules for Beat the Bot.
// Plain JavaScript, no libraries. Used by index.html and tests.html.
// Everything lives inside one object called BeatTheBot.

var BeatTheBot = (function () {

  // ---------- 1. Score ONE match ----------
  // prediction and actual both look like { home: 27, away: 23 }.
  // Pass null/undefined as the prediction if the player did not pick.
  function scoreMatch(prediction, actual) {
    var empty = { points: 0, result: false, margin: 'none', total: false };
    if (!prediction || !actual) return empty;

    var predMargin = prediction.home - prediction.away;
    var actMargin = actual.home - actual.away;

    // Result: same winner, or both a draw (Math.sign gives 1, -1 or 0).
    var resultCorrect = Math.sign(predMargin) === Math.sign(actMargin);

    var points = 0;
    var marginBonus = 'none';

    if (resultCorrect) {
      points += 3;
      var marginGap = Math.abs(Math.abs(predMargin) - Math.abs(actMargin));
      if (marginGap === 0) {
        points += 4;            // within 5 (+2) and exact (+2 more)
        marginBonus = 'exact';
      } else if (marginGap <= 5) {
        points += 2;
        marginBonus = 'within5';
      }
    }

    // Total points in the match within 10 — counts even if the winner was wrong.
    var predTotal = prediction.home + prediction.away;
    var actTotal = actual.home + actual.away;
    var totalClose = Math.abs(predTotal - actTotal) <= 10;
    if (totalClose) points += 1;

    return { points: points, result: resultCorrect, margin: marginBonus, total: totalClose };
  }

  // ---------- Helpers ----------
  function median(numbers) {
    var sorted = numbers.slice().sort(function (a, b) { return a - b; });
    var mid = Math.floor(sorted.length / 2);
    if (sorted.length === 0) return 0;
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  function sum(numbers) {
    return numbers.reduce(function (a, b) { return a + b; }, 0);
  }

  // How far off a pick was: home gap + away gap. Smaller = closer.
  function scoreError(prediction, actual) {
    return Math.abs(prediction.home - actual.home) + Math.abs(prediction.away - actual.away);
  }

  // ---------- 2. Build the whole leaderboard ----------
  // data = the contents of the JSON files:
  //   data.players          array of { name, emoji }      (the six humans)
  //   data.rounds           array of { round, match_ids }
  //   data.predictions      array of { player, match_id, home_score, away_score }
  //   data.botPredictions   array of { match_id, home_score, away_score }
  //   data.results          array of { match_id, home_score, away_score, verified }
  // Only results with verified === true are used.
  function buildLeaderboard(data) {
    var players = data.players.map(function (p) { return p.name; });

    // Quick lookups
    var actualById = {};
    (data.results || []).forEach(function (r) {
      if (r.verified === true) actualById[r.match_id] = { home: r.home_score, away: r.away_score };
    });
    var humanPick = {};   // "Name|match_id" -> { home, away }
    var submitted = {};   // "Name|round" filled in below
    (data.predictions || []).forEach(function (p) {
      humanPick[p.player + '|' + p.match_id] = { home: p.home_score, away: p.away_score };
    });
    var botPick = {};
    (data.botPredictions || []).forEach(function (p) {
      botPick[p.match_id] = { home: p.home_score, away: p.away_score };
    });

    var totals = {};
    players.forEach(function (n) { totals[n] = 0; });
    var botTotal = 0;
    var rounds = [];

    data.rounds.forEach(function (rd) {
      var matchIds = rd.match_ids;
      var scoredIds = matchIds.filter(function (id) { return actualById[id]; });
      var complete = matchIds.length > 0 && scoredIds.length === matchIds.length;

      var pointsByPlayer = {};
      var submittedByPlayer = {};
      var bestPick = null; // closest single pick this round

      players.forEach(function (name) {
        var pts = 0;
        var gaveAny = false;
        matchIds.forEach(function (id) {
          var pick = humanPick[name + '|' + id];
          if (pick) gaveAny = true;
          if (!actualById[id]) return;                 // result not in yet
          pts += scoreMatch(pick, actualById[id]).points;
          if (pick) {
            var err = scoreError(pick, actualById[id]);
            if (!bestPick || err < bestPick.error) {
              bestPick = { error: err, players: [name], match_id: id };
            } else if (err === bestPick.error) {
              if (bestPick.players.indexOf(name) === -1 || bestPick.match_id !== id) {
                bestPick.players.push(name);
              }
            }
          }
        });
        pointsByPlayer[name] = pts;
        submittedByPlayer[name] = gaveAny;
        totals[name] += pts;
      });

      var botPoints = 0;
      scoredIds.forEach(function (id) {
        botPoints += scoreMatch(botPick[id], actualById[id]).points;
      });
      botTotal += botPoints;

      var humanPointsList = players.map(function (n) { return pointsByPlayer[n]; });
      var humanMedian = median(humanPointsList);

      var winner = null; // 'humans', 'bot' or 'tie' — only once the round is complete
      if (complete) {
        winner = botPoints > humanMedian ? 'bot' : botPoints < humanMedian ? 'humans' : 'tie';
      }

      // Weekly awards (only once the round is complete)
      var awards = null;
      if (complete) {
        var top = Math.max.apply(null, humanPointsList);
        awards = {
          roundWinner: top > 0 ? players.filter(function (n) { return pointsByPlayer[n] === top; }) : [],
          closestCall: bestPick ? { players: bestPick.players, match_id: bestPick.match_id, error: bestPick.error } : null,
          botSlayers: players.filter(function (n) { return pointsByPlayer[n] > botPoints; })
        };
      }

      rounds.push({
        round: rd.round,
        complete: complete,
        matchesScored: scoredIds.length,
        matchesTotal: matchIds.length,
        playerPoints: pointsByPlayer,
        submitted: submittedByPlayer,
        botPoints: botPoints,
        humanMedian: humanMedian,
        winner: winner,
        awards: awards
      });
    });

    // ---------- Humans vs Bot series ----------
    // Each round: the Bot's points are set against the humans' MEDIAN. The series winner is whoever
    // has the most points after ALL the rounds: the Bot's total vs the humans' medians added up.
    // (Rounds won are still counted for interest, but they do not decide the series.)
    var humanWins = 0, botWins = 0, completeRounds = 0;
    var humanMedianTotal = 0, botCompleteTotal = 0;   // complete rounds only: these decide the series
    var humanPointsSoFar = 0, botPointsSoFar = 0;     // every round with results in: for showing live scores
    rounds.forEach(function (r) {
      if (r.matchesScored > 0) {
        humanPointsSoFar += r.humanMedian;
        botPointsSoFar += r.botPoints;
      }
      if (!r.complete) return;
      completeRounds++;
      humanMedianTotal += r.humanMedian;
      botCompleteTotal += r.botPoints;
      if (r.winner === 'humans') humanWins++;
      if (r.winner === 'bot') botWins++;
    });

    var seriesWinner = null;
    var decidedBy = null;
    if (rounds.length > 0 && completeRounds === rounds.length) {
      decidedBy = 'total points';
      if (botCompleteTotal > humanMedianTotal) seriesWinner = 'bot';
      else if (botCompleteTotal < humanMedianTotal) seriesWinner = 'humans';
      else seriesWinner = 'tie';
    }

    var standings = players.map(function (n) { return { name: n, total: totals[n] }; })
      .sort(function (a, b) { return b.total - a.total; });

    return {
      standings: standings,
      botTotal: botTotal,
      rounds: rounds,
      series: {
        humanWins: humanWins,
        botWins: botWins,
        humanMedianTotal: humanMedianTotal,
        botTotal: botCompleteTotal,
        humanPointsSoFar: humanPointsSoFar,
        botPointsSoFar: botPointsSoFar,
        winner: seriesWinner,
        decidedBy: decidedBy
      }
    };
  }

  return { scoreMatch: scoreMatch, buildLeaderboard: buildLeaderboard, median: median };
})();

// Lets Node (used only for quick checks) load this file too; browsers ignore it.
if (typeof module !== 'undefined') module.exports = BeatTheBot;

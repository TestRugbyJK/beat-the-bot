# Beat the Bot — project brief

## What this is
A rugby score-prediction league for the 2026 Nations Championship (November rounds 4–6).
Six players — Adam, Matt, Jerome, Grigor, Angus, Alex — and an AI "Bot" predict scores.
It's a fun, low-stakes project for friends: no logins, no passwords, keep everything simple.
The owner (Jerome) is a beginner: explain things in plain English and keep changes small.

## Weekly cycle (UK time; the UK is on GMT in November so UK time = UTC)
- Tue 00:00 – Thu 17:00: picks window for the NEXT weekend's round only. Players choose their
  name from a dropdown and enter scores on the website. Resubmitting replaces earlier picks.
- Thu after 17:00: /thursday runs (by hand for Round 4, then as a scheduled task). The Bot makes its predictions FIRST
  (it must never see human picks), then human picks are downloaded, saved and published.
- Fri–Sun: games.
- Monday 07:00: /monday runs (by hand for Round 4, then as a scheduled task). Results are found and verified, the Bot writes
  commentary, and everything is published. The website calculates the scores itself.

## Cost rule
Nothing in this project may require paid services, an Anthropic API key or a credit card.
The AI work (Bot predictions, finding results) is done by Claude Code itself, via the
/thursday and /monday slash commands, using its own web search.

## Technology (do not add frameworks or build tools)
- Website: a single index.html using plain JavaScript, plus Chart.js loaded from cdnjs.
- Scoring: scoring.js, a plain JavaScript file used by index.html, tested by tests.html.
- Picks storage: Google Apps Script web app + Google Sheet (code kept in /apps-script).
- Hosting: GitHub Pages, published by Jerome with GitHub Desktop.
- Data: JSON files in /data.

## Data files (in /data)
- rounds.json          — each round: picks_open, picks_close, results_expected, match_ids
- fixtures.json        — every match: id, round, home, away, kickoff (UTC)
- players.json         — the six players (name, emoji) plus the Bot
- predictions.json     — human picks, saved by /thursday after the window closes
- bot_predictions.json — Bot picks: scores, confidence, short rationale, sources
- results.json         — final scores, two source links each, verified true/false
- bot_commentary.json  — the Bot's weekly gloat or apology
- config.json          — the Apps Script web app URL

## Scoring rules
- Correct result (winner, or a draw): 3 points
- If the result is correct: winning margin within 5 of the actual margin: +2; exact margin: +2 more
- Total match points within 10 of the actual total: +1
- Maximum 8 per match. Every match counts the same.
- No picks submitted for a round = 0 for that round.
- Humans vs Bot: each round, the Bot's points vs the MEDIAN of the six players' points.
  The higher side wins the round. Best of three rounds wins the series; tiebreak is total points.

## The Bot's prediction rules (used by /thursday)
The Bot is meant to be a tough but beatable opponent. It predicts a score for every match in the round.

Research, for each match (use web search; news previews and odds-comparison pages are fine):
- rankings, recent form, team news, head-to-head
- the bookmakers' handicap (the expected winning margin) and the total-points line, if published

Use the line as a starting point, not the answer:
- Start from the handicap margin, then adjust it using the Bot's own reading of team news, form and conditions.
- Keep the predicted winning margin within about 7 points of the handicap, unless there is a strong, stated reason to go further.
- In every round, at least 2 of the 6 matches must differ from the handicap by 3 or more points, with the reason given
  (e.g. "bookies underrate Japan's new back row"). This stops the Bot copying the market.
- The Bot may back the underdog to win only with a genuinely strong reason, and at most once per round.
- Use the total-points line as a guide to how high-scoring the game will be, then adjust for teams' styles and the weather.
- If no line can be found for a match, use its own judgement and note "no line found".

Saving: each entry in bot_predictions.json holds the Bot's scores, confidence, one-line rationale and sources, plus the line:
  "line": { "favourite": "Scotland", "handicap": 4, "total": 44.5, "source": "https://..." }
or, if none was found, "line": "none found". (handicap = the favourite's expected winning margin; use 0 for a pick'em.)
The website shows "Bookies: Scotland by 4 · Bot: Scotland by 9" under the Bot's pick once picks are revealed.

## Rules for Claude Code
- The picks deadline must be enforced in the Apps Script, not just hidden on the website.
- The Bot must never be shown human picks before making its own predictions.
- Never save a result as verified unless two independent sources agree on the score.
- Design for mobile first (friends open the link from WhatsApp). Support light and dark mode.
- Keep the site low-profile: every page must include the noindex meta tag, robots.txt must block all crawlers, and no personal details beyond first names may be added.
- Before big changes, explain the plan in plain English and wait for my OK.

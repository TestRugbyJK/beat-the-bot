---
description: Monday morning - find and verify the weekend's results, score the round, write the Bot's comment, commit
---

Run the weekly Monday routine for Beat the Bot. Follow the steps IN ORDER. Explain things in plain English; the owner is a beginner.

## Step 1 - Which round?
Read data/rounds.json and data/fixtures.json. Find the round that was played at the weekend: the latest round whose matches have all kicked off (UTC = UK time in November). If no round has been played yet, STOP and tell the owner.

## Step 2 - Results
Read data/results.json and data/overrides.json (if it exists).

**Overrides always win.** data/overrides.json looks like:
```json
{ "overrides": [ { "match_id": "r4-m3", "home_score": 20, "away_score": 25, "note": "optional" } ] }
```
For every override in this round, write that score to results.json as `"verified": true` with `"sources": ["manual override"]`, and do not search for it. Don't edit overrides.json.

For each remaining match in the round that does NOT already have a verified result, use web search to find the final score from TWO independent, reputable sources (e.g. the official tournament site, BBC Sport, ESPN, a national rugby union's own match report). Two pages repeating the same agency copy are not independent.
- Save it as `"verified": true` ONLY if both sources agree on the score AND the team names match the fixture (home team = fixture's home, away = fixture's away). Save both links in `sources`.
- If a score can't be confirmed (sources disagree, only one source, match postponed or abandoned, nothing published yet) do NOT guess. Save it as `{ "match_id": "...", "status": "awaiting result", "verified": false, "sources": [] }` and tell the owner clearly, listing each such match, so they can check it themselves and add an override.

Verified entries look like:
```json
{ "match_id": "r4-m3", "home_score": 20, "away_score": 25, "sources": ["https://...", "https://..."], "verified": true }
```
Whole numbers only. Keep other rounds' entries untouched; replace this round's non-verified entries as needed.

## Step 3 - Score the round
Use scoring.js (the project's own scoring code, tested by tests.html) rather than doing the sums by hand. There is no Node or Python on this machine: run it by loading scoring.js and the data in a small temporary HTML page (put it in the scratchpad, not the project) opened in headless Edge (`msedge --headless --dump-dom`), or read the numbers off index.html loaded via the local preview server (`.claude/serve.ps1`, port 8080). If you can't run it, work it out by hand from the CLAUDE.md rules and say clearly that you did.
Only verified results count. Show the owner:
1. The round's table: each player's points per match and round total, the Bot's points, the humans' median, who won the round.
2. The running series score. Use the site's rule from CLAUDE.md: the Bot's running total versus the sum of the humans' round medians so far (the website does it this way, so the numbers must match). Also mention each player's running total for the league table.
If some matches are awaiting a result, say the round isn't complete and that scores are provisional.

## Step 4 - The Bot's weekly comment
Write 60-80 words (count them) in the Bot's voice: a confident, slightly smug but good-humoured rugby pundit.
- If the Bot is ahead of the Watch on the running score: gloat.
- If it's behind: gracious, but a little salty.
- Name the round's top human (first name only, and mention a specific match if you can). Be friendly to all six players. No personal details beyond first names.
- If the round isn't complete, say the Bot is waiting on the last result(s).
Save to data/bot_commentary.json as `{ "round": 4, "text": "..." }` in the `commentary` list, replacing any existing entry for the same round and keeping other rounds'.

## Step 5 - Check
- Every match in the round has an entry in results.json (verified or awaiting result); scores are whole numbers; each verified result has two sources (or "manual override").
- All JSON files parse correctly.
- Comment is 60-80 words.

## Step 6 - Commit
Commit data/results.json and data/bot_commentary.json (and overrides.json if the owner changed it) with the message "Round X results" (X = the round number). Git is not on PATH: use the git.exe bundled with GitHub Desktop (under %LOCALAPPDATA%\GitHubDesktop\app-*\resources\app\git\cmd\git.exe). Don't commit the .claude preview helper files. Do not push; remind the owner to click **Push origin** in GitHub Desktop.

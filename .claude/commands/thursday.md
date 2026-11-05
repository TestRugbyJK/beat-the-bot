---
description: Thursday after 5pm - Bot predicts first, then human picks are fetched, saved and committed
---

Run the weekly Thursday routine for Beat the Bot. Follow the steps IN ORDER. Explain things in plain English; the owner is a beginner.

## Step 1 - Which round?
Read data/rounds.json. Find the round whose `picks_close` has passed and whose results are not yet in (the latest round with `picks_close` before now, UTC = UK time in November). If no window has closed yet, STOP and tell the owner when the next one closes. If bot_predictions.json already has picks for that round, ask before overwriting.

## Step 2 - BE THE BOT (no peeking)
**Do NOT read data/predictions.json, call the reveal address, or look at any human picks during this step.**
Use data/fixtures.json for the round's matches. For each match, use web search to research:
- current world rankings
- recent form (including the July Nations Championship results)
- announced team selections and injuries
- head-to-head record
- the bookmakers' handicap line and total-points line, where published (news previews and odds-comparison pages are fine)

Rules (from CLAUDE.md):
- The handicap is a starting point, not the answer. Adjust for team news, form and conditions.
- Keep the predicted winning margin within about 7 points of the handicap unless there is a strong, stated reason.
- At least 2 of the 6 matches must differ from the handicap by 3 or more points, with the reason given in the rationale.
- Back the underdog to win only with a genuinely strong reason, and at most once per round.
- Use the total-points line as a guide to how high-scoring the game is, then adjust for styles and weather.
- Rugby draws are rare: only predict one with a very good reason.
- Scores are whole numbers. If no line is found, use own judgement and say "no line found".
- Personality: a confident, slightly smug but good-humoured rugby pundit.

Save to data/bot_predictions.json (keep other rounds' entries untouched), one entry per match:
```json
{
  "match_id": "r4-m3",
  "home_score": 24,
  "away_score": 20,
  "confidence": 65,
  "rationale": "Punchy reason, 25 words maximum.",
  "line": { "favourite": "Scotland", "handicap": 4, "total": 44.5, "source": "https://..." },
  "sources": ["https://...", "https://..."]
}
```
- `confidence` is 0-100. `line` is `"none found"` if no line was published (handicap = favourite's expected winning margin, 0 for a pick'em).
- Save the file BEFORE moving on. Do not continue to Step 3 until it is saved and valid JSON.

## Step 3 - Human picks (only after Step 2 is saved)
Read `apps_script_url` from data/config.json. Fetch `<url>?action=reveal&round=<N>` (use PowerShell Invoke-RestMethod; the address redirects, so follow redirects). If `ok` is false, show the message and stop.
Save the returned picks into data/predictions.json. Each pick has `player`, `match_id`, `home_score`, `away_score`; keep exactly those four fields. Replace any existing entries for this round; leave other rounds alone.

## Step 4 - Check everything
- All 6 matches of the round have Bot picks; every score is a whole number; confidence is 0-100; rationale is 25 words or fewer.
- Both JSON files parse correctly.
- Every human pick refers to a real match_id in this round, and scores are whole numbers.
- Note any player with no picks (they score 0 for the round).
- Check the margin rules (within ~7 of the line, at least 2 matches 3+ away from it) and report honestly if they can't be met.
Then show a summary table: one row per match, columns for each of the six players, the Bot's pick, and the bookmakers' line.

## Step 5 - Commit
Commit data/bot_predictions.json and data/predictions.json with the message "Round X picks locked in" (X = the round number). Git is not on PATH: use the git.exe bundled with GitHub Desktop (under %LOCALAPPDATA%\GitHubDesktop\app-*\resources\app\git\cmd\git.exe). Do not push; remind the owner to click **Push origin** in GitHub Desktop.

## Finally
Explain simply why the order of steps 2 and 3 matters: the Bot must make its predictions before it sees any human picks, otherwise it could copy or counter them and the contest wouldn't be fair. That's why the Bot's picks are saved first, and only then are the humans' picks fetched.

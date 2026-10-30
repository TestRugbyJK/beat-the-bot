# Setting up the picks back end (Google Sheet + Apps Script)

This takes about 15 minutes and costs nothing. You need a free Google account. You do **not** need a credit card.

**What you're building:** a Google Sheet that stores everyone's picks, plus a small program (`Code.gs`) that sits in front of it and checks the rules (right names, window open, every match filled in, scores 0–99).

---

## Before you start: check your website is live

The script reads the dates and matches from your live website, so the website must be published first.

1. In your browser, go to: https://testrugbyjk.github.io/beat-the-bot/data/rounds.json
2. You should see text starting with `{ "rounds": [`.
3. If you see "404 Not found", publish the site from GitHub Desktop and switch on GitHub Pages first. Come back here once that link shows text.

---

## Part A — Make the Google Sheet

1. Go to https://sheets.google.com and click **Blank spreadsheet** (the big **+**).
2. Click the title at the top-left ("Untitled spreadsheet") and rename it to **Beat the Bot picks**.
3. At the bottom-left you'll see a tab called **Sheet1**. Double-click it and rename it to exactly **Picks** (capital P, nothing else).
4. In row 1, type these six headings, one per cell, starting at cell A1:

   | A1 | B1 | C1 | D1 | E1 | F1 |
   |---|---|---|---|---|---|
   | submitted_at | player | round | match_id | home_score | away_score |

   (If you forget, don't worry — the script will add them itself the first time it runs.)

---

## Part B — Add the code

1. In your sheet's menu bar click **Extensions → Apps Script**. A new tab opens with a code editor.
   *Important: you must open it from inside the sheet like this, so the code is "attached" to the sheet.*
2. In the left column you'll see a file called **Code.gs** containing a few lines like `function myFunction() {}`.
3. Click inside the code, press **Ctrl+A** (select all), then **Delete**.
4. Open the file `apps-script/Code.gs` from this project (in VS Code, Notepad, or GitHub Desktop → "Open in editor"). Press **Ctrl+A**, then **Ctrl+C** to copy everything.
5. Go back to the Apps Script tab, click in the empty editor and press **Ctrl+V** to paste.
6. Press **Ctrl+S** (or click the 💾 save icon). If it asks for a project name, call it **Beat the Bot**.
7. Near the top of the code, check this line shows your website address (it should already):

   ```
   var SITE_URL = 'https://testrugbyjk.github.io/beat-the-bot/';
   ```

---

## Part C — Give the code permission (security warnings explained)

Google asks you to approve the script the first time it runs. Because *you* wrote it (well, we did), Google shows a scary-looking warning. This is normal for your own scripts.

1. At the top of the editor, find the drop-down next to **Run** / **Debug**. Choose the function **testSetup**.
2. Click **▶ Run**.
3. A box says **"Authorization required"**. Click **Review permissions**.
4. Pick your Google account.
5. You'll see **"Google hasn't verified this app"**. This just means Google hasn't reviewed it, because it's your own private script. Click **Advanced** (small grey text at the bottom-left), then click **Go to Beat the Bot (unsafe)**.
6. Google lists what the script wants to do: *see and edit your spreadsheets* and *connect to an external service*. That's exactly what it needs (it edits the picks sheet and reads your website). Click **Allow**.
7. The script runs. At the bottom you should see **Execution log** with:

   ```
   All good! Read 3 rounds and 18 fixtures from https://testrugbyjk.github.io/beat-the-bot/
   The "Picks" tab is ready.
   ```

   - If you see an error about a status of **404**, the website isn't live yet (see "Before you start").
   - If you see "Exception: ... SpreadsheetApp ...", you opened Apps Script from somewhere other than inside the sheet. Go back to Part B step 1.

---

## Part D — Publish it as a web app

This turns the code into a web address the website can talk to.

1. Click the blue **Deploy** button (top-right), then **New deployment**.
2. Click the ⚙️ cog next to "Select type" and choose **Web app**.
3. Fill in the form **exactly** like this:

   | Setting | Choose |
   |---|---|
   | Description | `Picks v1` |
   | **Execute as** | **Me** (your email address) |
   | **Who has access** | **Anyone** |

   *Why these?* "Execute as: Me" lets the script write to your sheet on everyone's behalf, so your friends never need to log in. "Anyone" lets them reach it without a Google account. The script itself enforces the rules (names, deadline, scores). Do **not** choose "Anyone with Google account" — that would make your friends log in.
4. Click **Deploy**.
5. If it asks you to authorise again, repeat the **Advanced → Go to … (unsafe) → Allow** steps from Part C.
6. Google shows a **Web app URL** ending in `/exec`. Click **Copy**. Keep it safe — this is the address of your back end.
7. Click **Done**.

---

## Part E — Tell the website the address

1. Open `data/config.json` in this project. It currently looks like:

   ```json
   {
     "apps_script_url": ""
   }
   ```
2. Paste your URL between the quote marks, so it looks like:

   ```json
   {
     "apps_script_url": "https://script.google.com/macros/s/LONG-CODE-HERE/exec"
   }
   ```
3. Save the file. (Ask Claude Code to do this if you prefer — just give it the URL.)

> The web address is not a password, but anyone who has it could send picks. That's fine: the script only accepts the six names, only during the window, and only complete, valid scores.

---

## Part F — Test it

**Test 1: "Who's in" (works any time).** Paste your URL into a browser, then add this on the end:

```
?action=whosin&round=4
```

So it looks like `https://script.google.com/macros/s/.../exec?action=whosin&round=4`. You should see:

```
{"ok":true,"round":4,"submitted":[]}
```

An empty list is correct — nobody has submitted yet.

**Test 2: "Reveal picks" is locked.** Use the same address with `?action=reveal&round=4`. Before Thursday 5 Nov 17:00 UK you should see a message beginning **"No peeking!"**. That proves the secret-until-deadline rule works.

**Test 3: Saving picks.** The picks window for Round 4 opens **Tuesday 3 Nov 00:00**. Before then, a submission is correctly refused with *"Round 4 picks are not open yet"*. Once the picks form on the website is built (the next step), you'll test it there. After you submit, check the **Picks** tab in your sheet: you should see 6 new rows (one per match).

---

## What the website will send (for later)

The picks form will send a **POST** to your URL with this shape:

```json
{
  "player": "Jerome",
  "round": 4,
  "picks": [
    { "match_id": "r4-m1", "home_score": 31, "away_score": 17 }
  ]
}
```

(one entry for each of the six matches). It must be sent with the header `Content-Type: text/plain`. This is a quirk of Apps Script: it stops the browser from blocking the request. Claude Code will handle this when building the form.

---

## If you change the code later

Editing `Code.gs` does **not** update the live web app automatically. Each time you change it:

1. Paste the new code in and save (**Ctrl+S**).
2. Click **Deploy → Manage deployments**.
3. Click the ✏️ pencil next to your deployment.
4. Under **Version**, choose **New version**, then click **Deploy**.

The web address stays the same, so `config.json` doesn't change.

---

## Handy extras

- **Changed dates on the website but the script is still using the old ones?** It remembers the website's data for 10 minutes. Wait, or select the function **clearCache** in the editor and click **Run**.
- **Seeing who's in:** just look at the **Picks** tab. Each person's picks appear as six rows.
- **Safety:** only share the sheet itself with people you trust. Anyone who can open it can see everyone's picks, which would spoil the surprise before Thursday!

---

## What the script checks (so you know what's protected)

When picks arrive, they're **rejected** unless all of these are true:

- the name is one of Adam, Matt, Jerome, Grigor, Angus or Alex;
- the time right now (Google's clock, not the visitor's) is inside that round's picks window;
- there's exactly one pick for every match in that round, with no repeats or strangers;
- every score is a whole number from 0 to 99.

If accepted, that player's earlier picks for the round are replaced. A lock makes sure two people pressing Submit at the same moment can't mix up the sheet.

# Tips for Getting the Best Out of Claude

A personal reference file — updated as we go. Plain English throughout.

---

## How to Describe Problems Clearly

**Tell Claude what you see AND what you want.**
Instead of: "It's not working"
Try: "When I open the Work tab, I can only see two tabs (Summary and Tasks). I expected to also see an Onboarding tab."

This saves Claude from guessing and avoids wasted back-and-forth.

**Include where you are looking.**
Saying "in the Work tab, under the Tasks section, the daily task list" is far more useful than "that list we built". Claude doesn't know which screen you're on.

**Describe what happens vs what should happen.**
"When I click the Onboarding tab, nothing appears" is clearer than "the onboarding isn't working."

---

## Reducing Wasted Tokens (Making Sessions More Efficient)

**One thing at a time where possible.**
Mixing five requests in one message means if one is unclear, all five get delayed. Short, focused requests move faster.

**Say "check first, then make the change" for big features.**
This lets Claude confirm it understood before writing hundreds of lines of code. Saves redoing work.

**Reference names consistently.**
Stick to the same names used in the dashboard: "Work tab", "Onboarding tab", "To Do List tab". Claude matches on these names and avoids confusion.

**If a session runs long, ask for a summary.**
Claude's memory has a limit. Asking "can you summarise what we've done and what's left?" before a big task helps Claude stay accurate.

---

## Phrases That Work Well

- "Before you start, can you tell me what you're planning to do?" — confirms Claude understood
- "In plain English, what did you just change?" — forces a simple explanation, no jargon
- "Just the code, no explanation needed" — saves tokens when you don't need the walkthrough
- "Can you check the file first and tell me if this is already done?" — avoids duplicate work
- "Can you push it to the live site?" — means push to the `main` branch on GitHub
- "Do it in small steps and show me each one" — useful for complex changes

---

## Understanding What's Happening With Your Dashboard

**The dashboard is a static website** — it runs entirely in your browser. There's no server. Data is saved locally in your browser's storage (called `localStorage`), so clearing your browser data would reset everything.

**Changes go through three steps:**
1. Claude edits the files on its machine
2. Claude commits and pushes to GitHub
3. GitHub Pages (the live site) picks up the changes automatically — usually takes 1–3 minutes

**If you don't see a change live:**
Try `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows) to force-refresh. GitHub Pages can serve a cached version for a few minutes.

---

## What Claude Needs When Something Looks Wrong

The more of these you can include, the faster it gets fixed:

| What to share | Why it helps |
|---|---|
| Which tab / section | Narrows down which file to look at |
| What you expected to see | Gives Claude a target |
| What you actually see | Helps diagnose the gap |
| Whether it ever worked | Tells Claude if it's a regression or never worked |

---

## Things That Save Time Across Sessions

- Sessions don't carry memory automatically — Claude gets a summary of what was done, but may miss detail from earlier conversations
- If something was built in a previous session and now seems missing, mention which session it was from or describe it clearly
- The file `.claude/user-tips.md` (this file) is in the repository — Claude can read it at any time for context on how you prefer to work

---

## Your Preferences (Noted)

- Plain English only — no technical jargon unless explained
- Small changes at a time, committed in steps
- Always offer a free/no-account option first when building new features
- Dashboard should feel premium, calm, and minimal (Apple dark mode feel)
- You are learning — explanations are welcome and encouraged

---

*Last updated: May 2026*

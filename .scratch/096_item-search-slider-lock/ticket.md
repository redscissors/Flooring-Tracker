---
issue_type: Feature
summary: The Item search fuzzy-cutoff sliders sit in the Price books settings
  strip where a stray drag (or a phone swipe through the strip) silently
  retunes the whole team's search — they needed a lock.
status: done
labels: [ready-for-human]
---

# Lock on the Item search slider bars

Reported 2026-08-14: "add a lock to the item search slider bars."

## Change

The Item search card (`ItemSearchCard`, extracted in `src/pricebooklib.jsx`)
now opens LOCKED on every visit: both range inputs are disabled and drawn
dimmed, and a padlock button on the card's eyebrow arms them. Nothing is
persisted — closing or reloading the page re-locks, so the guard can't be left
off. The HelpTip mentions the padlock.

Preview proof: `card-locked.png` (default) and `card-unlocked.png` (padlock
clicked, sliders live) — taken from the `header-preview.html` harness.

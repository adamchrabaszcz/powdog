# 0004. Avalanche danger from the EAWS feed

- Status: Accepted
- Date: 2026-11-27

## Context
Every pick must show the avalanche danger where a bulletin exists. Scraping each national service's website would break often.

## Decision
Read the free EAWS bulletins in CAAML v6 JSON from `static.avalanche.report/eaws_bulletins/<date>/<date>-<REGION>.json`. On 2026-11-27 this returned data for `CZ` (Krkonoše, Jeseníky), `SK` (Slovak ranges), `PL-12` (Polish Tatras), `AT-04` (including `AT-04-01` Dachstein), `AT-06`, `AT-07` and `CH`. Each spot names its region in the catalogue.

## Consequences
- One parser for all regions; danger levels split by elevation come for free.
- Polish Karkonosze, Śnieżnik and the Beskids have no bulletin in the feed; those spots say "no bulletin" and never show a guessed level.
- A missing or late bulletin must never be shown as current (a review point in `AGENTS.md`).

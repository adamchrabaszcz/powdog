# 0002. One Cloudflare Worker with static assets

- Status: Accepted
- Date: 2026-11-27

## Context
powdog needs a job that runs every couple of hours, a small API, a dashboard and a place to keep a little state, all free. A Mac-only script (launchd) would work for one person but not online, on a phone or for friends.

## Decision
One Cloudflare Worker: Cron Triggers run the collector, `fetch()` serves `/api/*`, and the dashboard is served as the Worker's static assets. State lives in KV (latest results, alerts already sent) and D1 (catalogue, history, personal data). Cloudflare Access protects the dashboard and the API. Pull requests get preview deployments.

## Consequences
- Free tier limits apply (CPU time per run, KV writes per day, D1 size); runs are designed to stay well inside them (ADR 0008).
- The Mac side is only a SwiftBar script reading `/api/latest.json`; no logic runs on the Mac.
- Code that touches Cloudflare is kept at the edges so the core can move (ADR 0010).

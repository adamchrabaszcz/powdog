# 0010. Portability and growth

- Status: Accepted (rules); the growth steps are a draft
- Date: 2026-11-27

## Context
If powdog works, it may outgrow the free tiers: Cloudflare Access is free for up to 50 users, and Open-Meteo's free use is non-commercial. It should be possible to grow or move without rewriting the core.

## Decision
Four rules from day one:

1. The model, scoring and snowpack code are plain TypeScript with no Cloudflare APIs.
2. Storage sits behind one small interface, with plain SQL migrations (D1 is SQLite, so Turso or Postgres means one adapter).
3. "Who is this user" lives only in `getUser(request)`.
4. Sending notifications lives only in `notify(user, message)`.

Draft steps for when it grows, each needing its own record:

1. Own login (magic links or passkeys) for users; Access stays for admin pages.
2. Workers paid plan for more CPU time and larger D1 limits.
3. Open-Meteo's paid API, or self-hosting it (it's open source).
4. Web push from the dashboard installed as an app, or a self-hosted ntfy.
5. AI digests stay per region, so their cost follows regions, not users.

## Consequences
- The core can be tested and run outside Cloudflare.
- A move touches the four seams, not the model.

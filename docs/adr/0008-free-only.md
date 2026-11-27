# 0008. Free only

- Status: Accepted
- Date: 2026-11-27

## Context
powdog is a personal tool first. It should cost nothing to run, and adding a paid piece should be a conscious choice rather than drift.

## Decision
Use only free services and free tiers: Cloudflare Workers, KV, D1, Access and Workers AI; Open-Meteo; the EAWS feed; ntfy; SwiftBar. Every scheduled run, API call, KV write and D1 query is counted against those limits. A paid service, API or plan needs a new record that supersedes this one.

## Consequences
- Some choices are weaker than paid ones (the AI model, rate limits), and the code works around them (batching, shared digests).
- The review checks the free budget on every pull request (`AGENTS.md`).

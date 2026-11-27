# Architecture

How powdog is put together. Why it's built this way is in `docs/adr/`; what gets built next is in the [GitHub issues](https://github.com/adamchrabaszcz/powdog/issues).

Keep this to what a newcomer needs before changing something: the parts, where each lives, how data flows between them. Update it in the pull request that changes the structure.

## The parts (planned)

```
Cron, 4× a day ─► Worker: scheduled()   (+ once a day: past weather and ensemble)
                   ├─ Open-Meteo: forecast, ensemble, past weather, pressure levels (batched, summit elevation)
                   ├─ EAWS feed: avalanche danger per region
                   ├─ core: snowpack model, front detection, scoring per riding mode
                   ├─ AI digest, once or twice a day (Workers AI)
                   ├─ KV: the latest result per user and the alerts already sent
                   ├─ D1: spot catalogue, forecast history, users, trips, ratings
                   └─ ntfy: notifications when something crosses a threshold
Worker: fetch()   ─► /api/latest.json (behind Cloudflare Access)
Static assets     ─► the dashboard (behind Cloudflare Access)
macOS             ─► a SwiftBar script that reads /api/latest.json
```

- **Shared vs personal:** conditions are computed once per spot in the shared catalogue; each user's ranking reorders them with that user's settings ([ADR 0009](adr/0009-multi-user-ready.md)).
- **Portable core:** the model, scoring and snowpack code are plain TypeScript with no Cloudflare APIs. Users (`getUser(request)`), storage and notifications (`notify(user, message)`) each sit behind one interface ([ADR 0010](adr/0010-portability-and-growth.md)).

## Layout

| Path | What |
| --- | --- |
| `.github/workflows/` | CI, the format check, releases and the Claude review |
| `docs/` | This file and the decision records |
| `docs/brand/` | The logo in colour and one ink, and the simple icon |
| `package.json` | Node scripts (`npm test`); dependencies come with the first code |

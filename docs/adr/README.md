# Architecture decision records

One file per decision that is costly to reverse, or that people will ask "why?" about. `docs/architecture.md` says what the code does; these say why.

- **Name:** `NNNN-decision-title.md`, numbered in order; numbers are never reused.
- **Never deleted.** A changed decision gets a new record, and the old one's status becomes `Superseded by NNNN`.
- **Short:** a page at most, written in the pull request that makes the decision.

## Template

```markdown
# NNNN. Decision title

- Status: Proposed | Accepted | Superseded by NNNN
- Date: YYYY-MM-DD

## Context
What forces the decision: the problem, the constraints, the options considered.

## Decision
What we do, in one or two sentences, then any detail.

## Consequences
What becomes easier, what becomes harder, what we now have to keep doing.
```

## Records

- [0001. Record architecture decisions](0001-record-architecture-decisions.md)
- [0002. One Cloudflare Worker with static assets](0002-cloudflare-worker.md)
- [0003. Open-Meteo as the weather source](0003-open-meteo.md)
- [0004. Avalanche danger from the EAWS feed](0004-eaws-avalanche-feed.md)
- [0005. Rebuild the snowpack each run; keep every forecast in D1](0005-snowpack-and-history.md)
- [0006. Workers AI writes the digest from computed numbers only](0006-ai-explains-computed-numbers.md)
- [0007. Notifications through ntfy, with signed action links](0007-ntfy-notifications.md)
- [0008. Free only](0008-free-only.md)
- [0009. Ready for more users from day one](0009-multi-user-ready.md)
- [0010. Portability and growth](0010-portability-and-growth.md)
- [0011. Modular code that follows SOLID](0011-modular-solid-code.md)

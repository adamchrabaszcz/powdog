# 0006. Workers AI writes the digest from computed numbers only

- Status: Accepted
- Date: 2026-11-27

## Context
A short written take ("best bet Saturday, here's why, skip this one") is the most useful output, but a language model will happily invent snow that isn't forecast. Running Claude from a terminal can't work in the cloud, and a paid API is out (ADR 0008).

## Decision
The code computes everything: scores, snowpack, avalanche levels, confidence. Workers AI only turns a compact summary of those values into text, once or twice a day. The prompt tells it to quote the numbers it's given, say when models disagree, and never add conditions. One digest is written per region and shared.

## Consequences
- Free within the Workers AI daily allowance; per-region digests keep it free as users grow.
- The model is weaker than Claude, but the job is small. A switch to a paid model would need a new record.
- A test checks that every number in the digest exists in its input.

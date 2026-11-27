# 0009. Ready for more users from day one

- Status: Accepted
- Date: 2026-11-27

## Context
It starts as one person's tool, but friends should be able to use it with their own home base and favourites, and a public "best spots around me" page is planned. Retrofitting users into a single-user data model is a big refactor.

## Decision
- **Shared vs personal:** the spot catalogue and all per-spot conditions are shared and computed once per spot. Home base, favourites, riding modes, weights, trips, ratings and notification channel are personal.
- **Every personal table in D1 has a `user_id`** from the first migration; the first user is the owner.
- **The catalogue** is loaded from a versioned config file; favourites link users to catalogue spots.
- **Identity** comes from Cloudflare Access (email) through one `getUser(request)` function.
- **The public page** reads only precomputed data and never shows anyone's trips or ratings.
- **Privacy:** D1 is created with EU data location; shared learning from ratings is opt-in, anonymised and aggregate-only; export and delete arrive with the friends step.

## Consequences
- Ten users cost about the same as one: rankings are cheap reorderings of shared results.
- A slightly larger first schema, in exchange for no migration later.

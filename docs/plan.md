# Plan

What powdog is for, what it does, and in what order it gets built. Decisions behind it are in [`adr/`](adr/README.md); how the parts fit together is in [`architecture.md`](architecture.md). The roadmap is the issue list: one issue per build step below.

## The problem

Finding the best snow takes too long. Checking several forecast sites, avalanche bulletins and webcams for a handful of ranges every few days, then guessing which one will have powder, on a good base, in good weather, at a weekend that fits. powdog does that work and gives an honest answer: the top picks, when, why, and how sure it is.

## Who rides what

One rider, three ways of riding, each scored differently:

| | Lift powder | Splitboard | Splitboard with the dog |
| --- | --- | --- | --- |
| **Snow** | Fresh overnight, the first day after a storm; deeper is better | Deep and light; north aspects keep powder for days in the cold | Light powder that isn't too deep (the dog is about 35 cm tall), or a few cm of new snow on a firm base |
| **Weather** | Visibility matters less among trees; lifts must run, so wind counts against | Clear days preferred; ridge wind counts against | A clear, sunny day is required; low wind; not too cold for the dog |
| **Avalanche** | Shown as a warning | Weighs heavily; the day after a storm is often a "wait" | Level 1–2 only, gentle terrain |
| **Other** | Resort open; weekdays score higher | Approach length, terrain options | Dogs allowed in the area (national park rules differ); shorter tours |

The best dog day is often two or three days after a storm, when the snow has settled and the sky has cleared.

## Where

A home base in south-west Poland (kept in D1 with the user's settings, not in the repo), and ranges by reach:

- **Local, up to about 4 hours:** Karkonosze / Krkonoše, Jeseníky, Śnieżnik and Czarna Góra, the Beskids, the Tatras (Polish and Slovak)
- **Long drive:** Dachstein / Krippenstein, the Alps
- **Fly:** for exceptional storms only, e.g. Georgia or North Macedonia

The starting spot catalogue: Szrenica, Śnieżka / Łomniczka, Špindlerův Mlýn, Pec pod Sněžkou; Praděd, Červenohorské sedlo, Ramzová; Czarna Góra, Śnieżnik; Pilsko, Skrzyczne; Kasprowy Wierch, Hala Gąsienicowa, Jasná / Chopok; Krippenstein; a few Alpine spots. Each spot has coordinates, top and base elevation, drive time, webcam links, its avalanche bulletin region and whether dogs are allowed.

## What it does

### Forecast and snowpack

- **Forecasts** from Open-Meteo at each spot's summit elevation: snowfall, snow depth, temperature, freezing level, wind and gusts, cloud and sun, from several models (ECMWF, ICON-D2, GFS), so disagreement between them is visible.
- **Snowpack model:** each spot's snow is rebuilt from past weather every run: snowfall in, melt out on warm days, and flags for rain on snow, thaw-then-freeze crusts and wind-packed snow. Twenty centimetres forecast on a melted-out base scores low; new snow on a crust is both a quality problem and an avalanche warning sign.
- **Avalanche danger** per spot from the free EAWS feed, split by elevation. The Czech, Slovak, Polish Tatras, Austrian (including Dachstein) and Swiss services are covered. Polish Karkonosze, Śnieżnik and the Beskids have no bulletin; those spots say so.

### Where the snow comes from

Fronts are detected from the data (pressure drop, wind shift, temperature drop at about 1500 m), and each region has a rule for which flow brings it snow: north-westerly flow loads the north sides of the Sudetes, the Tatras and the Dachstein; southerly flow brings föhn to the north sides and snow to the southern Alps; westerly flow mostly feeds the Alps while the Sudetes sit in their shadow. The dashboard shows this on a map with a time slider.

### Picks and planning

- **Top 3 now** (next three days) for each riding mode, with weather, timing, avalanche level and webcam links.
- **Plan ahead** (4–15 days) from the ensemble forecast, as probabilities: "65% chance of 20+ cm at Praděd, Dec 12–13".
- **Far-trip radar** (2–4 weeks) for long drives and flights: a favourable tendency plus an existing good base gives "start preparing", then "getting real", then "book it".
- **Suggestions beyond the favourites:** a wider catalogue of ski areas within reach is scored too, and anything that clearly beats the favourites shows up as "worth checking", with links to touring routes and powder runs.

### The honest take

Once or twice a day an AI writes a short judgement: the best pick and why, what to avoid, and how sure the forecast is. It only quotes numbers the code computed and never invents conditions.

### Trips and learning

- **"I'm going"** from the dashboard, a notification or the menu bar saves the trip with a snapshot of the forecast at that moment.
- **One-tap rating** that evening (great, good, meh, bad); a detailed form comes later.
- **Forecast checks** run on their own: forecast against what actually fell, per spot and model, so each region uses the model that works best there and each spot's usual over- or under-forecast is corrected.
- **Weight proposals:** after enough ratings, powdog proposes changes to the scoring weights with a reason. Nothing changes until it's accepted, and every change is versioned.

### Where it shows up

- **macOS menu bar** (SwiftBar): the top pick in the bar, the top 3 and the plan-ahead windows in the menu.
- **Notifications** through ntfy, on the phone and mirrored to a Garmin watch: the important part in the first ~40 characters, plain text. Buttons work on the phone only.
- **Dashboard** behind Cloudflare Access: map, fronts, charts, the AI text, trips.
- **Later:** friends with their own settings, and a public "best spots around me" page.

## Build order

One step per issue, each split into sub-issues when it starts. Each step is useful on its own.

| Step | Issue | What |
| --- | --- | --- |
| 1 | #3 | Core: forecasts, snowpack model, scoring, D1 history, the menu bar |
| 2 | #4 | Avalanche levels and notifications |
| 3 | #5 | Trips: "I'm going" and one-tap rating |
| 4 | #6 | Plan ahead: 15-day snowfall windows |
| 5 | #7 | Daily AI digest |
| 6 | #8 | Fronts map and dashboard design |
| 7 | #9 | Learning: detailed feedback, forecast checks, weight proposals |
| 8 | #10 | Suggestions beyond favourites and touring routes |
| 9 | #11 | Far-trip radar: drive or fly |
| 10 | #12 | Friends: personal settings and notifications |
| 11 | #13 | Public "best spots around me" page |

## Friends and the public page, later

The data is split from day one into what's shared and what's personal ([ADR 0009](adr/0009-multi-user-ready.md)):

- **Shared:** the spot catalogue and everything computed for a spot. It's computed once per spot, however many people use it.
- **Personal:** home base, favourites, riding modes, weights, trips, ratings and notification channel, each row scoped by user.

Ratings stay private. Shared learning is opt-in, anonymised (no user, home or email), and used only in aggregate once a spot has ratings from at least a few different people; with a small group, one rating could otherwise point to one person. Export and delete come with the friends step. D1 is created with EU data location.

Growing past the free 50-seat login limit, or moving off Cloudflare, is drafted in [ADR 0010](adr/0010-portability-and-growth.md).

## Brand

The logo is a folded-paper dog head in ski goggles: a faceted head, floppy ears, one-line goggles whose middle reflects a snowy ridge with pines and whose sides are black, and a rounded nose with an even gap to the goggles. It comes in colour (cream coat, darker ears, blue sky) and in one ink; icons and the menu bar use a simple version of the same shape. Files are in [`brand/`](brand/). The final drawing is done in Pencil with the dashboard design (step 6).

## What the data can't tell us

- Beyond about 7 days, snowfall amounts are only probabilities; at 2–4 weeks only tendencies. The text says so every time.
- Resort snow reports are optimistic; the snowpack model and webcams are the check.
- Some ranges have no avalanche bulletin. The app says so and never fills the gap with a guess.
- Scoring weights start as a reasonable guess and get better with ratings over a few weekends.

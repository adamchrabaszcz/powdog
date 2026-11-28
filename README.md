# powdog

<img src="docs/brand/logo-colour.svg" alt="powdog logo: a folded-paper dog head in ski goggles" width="120">

[![test](https://github.com/adamchrabaszcz/powdog/actions/workflows/test.yml/badge.svg?branch=main)](https://github.com/adamchrabaszcz/powdog/actions/workflows/test.yml)

Powder radar for lift, splitboard and dog tours: where and when the best snow is, from free forecasts and avalanche bulletins, in the macOS menu bar, a web dashboard and phone notifications.

## Run it

```sh
npm ci
npm test
```

### Today's picks, on your machine

```sh
npm run picks
```

Fetches the latest forecasts for every spot in `config/spots.json` from Open-Meteo, builds each spot's snowpack and prints the top 3 spots per riding mode (lift, splitboard, splitboard with the dog) for today and the next two days, with the reasons and how sure the forecast is. It needs Node 24 and an internet connection, and makes one request to Open-Meteo. Avalanche levels aren't read yet: where a bulletin exists, check it yourself.

## Docs

- [`CONTRIBUTING.md`](CONTRIBUTING.md): how to work here
- [`AGENTS.md`](AGENTS.md): the short version for coding agents
- [`SECURITY.md`](SECURITY.md): reporting security problems
- [`docs/architecture.md`](docs/architecture.md): how it's put together
- [`docs/adr/`](docs/adr/README.md): why it's built this way
- Planned work: [GitHub issues](https://github.com/adamchrabaszcz/powdog/issues)

## Licence

The code is under the [MIT licence](LICENSE). The powdog name and the logo (the files in `docs/brand/`) are not covered by it: please don't use them for your own copy or fork.

# 0011. Modular code that follows SOLID

- Status: Accepted
- Date: 2026-11-28

## Context
The first core modules (catalogue, Open-Meteo client, snowpack) work and are tested, but a review against SOLID found the usual drift starting: `buildSnowpack` does five jobs in one loop, its thresholds can only be changed by editing the code, and the spot shape is written twice (TypeScript type and JSON Schema). Scoring is next and would copy those patterns. ADR 0010 already keeps the core free of Cloudflare APIs; this goes one step further, inside the core.

## Decision
Code follows SOLID, applied to plain TypeScript functions:

- **Single responsibility:** a module or function does one job. A function that adds, decides and formats becomes a short pipeline of named steps, each tested on its own.
- **Open/closed:** rules and thresholds that will be tuned (snowpack, scoring weights) live in one settings object or a config file, not in `if` chains.
- **Liskov substitution:** fakes used in tests keep the real contract (same inputs, same shape of output, same error behaviour).
- **Interface segregation:** a function takes only the input it needs (the snowpack takes `WeatherHour`, not an Open-Meteo series).
- **Dependency inversion:** I/O, storage, time and platform APIs stay at the edges (ADR 0010); the core gets data and **settings as parameters, with defaults**, so tests and the weight proposals (step 7) can pass other values without editing code.

Two habits follow:

- **One source of truth per shape:** a type and a schema for the same thing are not written out twice; one is generated from the other or checks it.
- **Files don't keep growing:** when a file or function passes a screenful, or a change has to reach into a long one, split it first, in its own pull request if it's big.

## Consequences
- Each step can be tested alone with fixed inputs; the fixed-weather and ranking tests stay small.
- The review checks new code against these rules (`AGENTS.md`), and #33 brings the first modules in line before scoring builds on them.
- A little indirection (a settings parameter with defaults) appears before it's strictly needed.

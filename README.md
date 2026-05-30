# parcie

Constraint-driven pallet packing for grocery distribution. A CP-SAT engine
places a fixed set of cartons on a pallet while respecting stacking, fragility,
and weight limits, and a Next.js app lets you set the constraints, run a solve,
and inspect the result.

## How it fits together

```
/constraints  --POST config-->  /api/solve (Next proxy)  -->  FastAPI POST /solve  -->  CP-SAT
     ^                                                                                    |
     |                                solution JSON  <-------------------------------------
     v
solution store (localStorage)  -->  /pallet (geometry) + /engine (solver stats)
```

The front-end never runs Python directly. It posts a config to a Next route
handler (`src/app/api/solve/route.ts`), which proxies to the FastAPI service
(`engine/api.py`). The returned solution is held client-side in
`src/lib/solution-store.tsx` and rendered on `/pallet` and `/engine`. The app
ships with a seed solution (`src/lib/solution.json`) so the views render before
the first solve.

## Layout

| Path | What it is |
| --- | --- |
| `engine/` | The CP-SAT model, config schema, click CLI, and FastAPI app (Python, `uv`) |
| `src/app/` | Next.js routes: `/`, `/constraints`, `/engine`, `/pallet`, `/route` |
| `src/components/` | The constraints panel, pallet viewer, engine panel, route viewer |
| `src/lib/` | Shared types, the solution store, the seed `solution.json`, routing math |
| `tests/` | End-to-end engine tests (`pytest`) |

## The model

Heterogeneous 3D bin packing as an orthogonal-packing formulation. Two cartons
do not overlap iff they are separated on at least one of the x, y, z axes,
expressed as a bool-or over reified separations (no Big-M). On top of that:

- Pallet bounding box.
- Support: every carton sits on the deck or rests flush on a carton it overlaps.
- Stacking compatibility: a carton may only rest on one that can bear its weight.
- Orientation: footprint may rotate 90 degrees; height is fixed.
- Symmetry breaking on identical cartons.

The primary objective minimises the stack envelope height. For a fixed carton
set on a fixed footprint that is the same thing as maximising volume
utilisation, so there is nothing to trade within "packing tightness".

### Stability tie-break

The height objective is degenerate: many packings reach the same optimal height.
With the stability lever on, the engine solves lexicographically: first it finds
the minimum height H, then it fixes `height == H` and minimises the load's
vertical centre of mass (sum of carton weight times centre height). This settles
heavy cartons low without giving up any height. It is a tie-break, not a
weighted trade-off: the pack never gets taller to get more stable.

The whole model is built by `build_model` in `engine/model.py`; everything else
goes through that one entrypoint.

## Prerequisites

Tool versions are pinned in `.mise.toml` (Python 3.13, Node 22, pnpm 10). With
[mise](https://mise.jdx.dev) installed:

```sh
mise install
```

Python deps are managed with [uv](https://docs.astral.sh/uv/), Node deps with
pnpm:

```sh
uv sync          # creates .venv, installs ortools, fastapi, click, pytest
pnpm install
```

## Running it

Two processes: the engine and the app.

```sh
# 1. engine (terminal one)
uv run uvicorn engine.api:app --port 8000

# 2. app (terminal two)
pnpm dev
```

Open http://localhost:3000. On `/constraints`, toggle a stacking pair or the
**Settle heavy items low** lever and press **Save & solve**; you land on
`/pallet` with the new solve, and `/engine` shows the matching solver stats and
the resulting centre of mass. `/engine` also has a **Re-solve** button that
re-runs the last config.

The app talks to the engine through the `/api/solve` proxy. Point it elsewhere
with the `ENGINE_URL` env var (default `http://127.0.0.1:8000`).

## Engine CLI

The same solve core is exposed as a click command. No running server needed.

```sh
uv run -m engine.solve                          # solve the defaults, JSON to stdout
uv run -m engine.solve --quiet                  # suppress the CP-SAT search log
uv run -m engine.solve -i config.json           # solve a config from the app
uv run -m engine.solve -o src/lib/solution.json # regenerate the seed the app ships with
```

Flags: `--time-limit` (seconds), `--workers`, `--quiet`. The config JSON is the
same `SolveRequest` shape the API takes.

## Tests

```sh
uv run pytest
```

Engine tests are end-to-end: each builds the full model via `build_model` and
asserts on the solved placement. One test (`test_model_dimensions_match_proto`)
checks that the variable and constraint counts shown on `/engine` sum to the
real model proto, so the displayed breakdown cannot silently drift from what is
actually solved.

## What is and is not wired

Live inputs that change the solve:

- The stacking-compatibility matrix. Forbidding a pair is a hard constraint.
- The **Settle heavy items low** stability lever (the lexicographic tie-break).

Recorded with the request but not yet acting on the solve:

- The objective-weight sliders. The model optimises a single primary objective
  (height), so the weights have nothing to trade against.
- The free-text custom rules. They are not yet parsed into CP-SAT terms.
- The `/route` view uses the shipped seed boxes, not the live solution.

These are called out in the UI rather than implied to work.

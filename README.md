# Rack — a 3D system design game

Learn system design by building architectures out of blocks, running real
traffic through them, and watching them break.

You place a load balancer, some API servers, a cache and a database on an
isometric floor, wire them together, and hit **Run Traffic**. Requests stream
through as visible packets. Overloaded components glow red, queues pile up,
dropped requests fall through the floor. The scoreboard gives you p99 latency,
error rate and cost per hour — and tells you which one you failed.

> **Status: two playable levels.** Pick a level, read the brief, build
> within its palette, hit Run Traffic, and get a verdict explaining why the
> design held up or didn't. Free play is still there for open-ended
> experimenting. Level 3 (queue-absorbed write bursts) needs engine work —
> request typing and asynchronous completion — that hasn't been built yet;
> see `docs/DESIGN.md` §6. See [`docs/DESIGN.md`](docs/DESIGN.md) for the
> full design and build plan.

Level 2, without the cache the level is built around:

> *34,525 requests failed — SQL Primary ran out of capacity and started
> shedding requests. It accounts for 100.0% of the failures, and its queue
> peaked at 1,600 waiting requests. Give it more capacity, or take work off
> it.*

Add a cache in front of the database, same API tier otherwise, and it
passes: p99 80ms (target 250ms), 0% errors.

## Running it

```bash
npm install
npm run dev
```

Other scripts: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.

## Deployment

Pushes to `main` build and deploy automatically to GitHub Pages via
`.github/workflows/deploy.yml`, which re-runs the full CI gate (typecheck,
lint, test) before publishing — nothing broken ships. Trigger a deploy by
hand from the Actions tab (`workflow_dispatch`) if you need one outside a
push.

`vite.config.ts`'s `base` is already set for this repo's project-page URL;
override it with `BASE_PATH=/` only if deploying to a root domain instead.

## Layout

| Path | What lives there |
|---|---|
| `src/sim/` | Simulation engine — pure TypeScript, no React, no Three.js |
| `src/state/` | Zustand store: topology, run status, selection |
| `src/scene/` | react-three-fiber rendering |
| `src/levels/` | Levels, defined as plain data, plus the free-play sandbox |
| `docs/DESIGN.md` | Design doc, component roster, phase plan |

The separation in that table is the project's one architectural rule: the
engine never imports the renderer. It keeps the simulation deterministic and
unit-testable, and it lets CI verify that every shipped level is actually
solvable. A lint rule enforces it.

## License

Apache 2.0 — see [LICENSE](LICENSE).

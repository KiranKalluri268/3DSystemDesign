# Rack — a 3D system design game

Learn system design by building architectures out of blocks, running real
traffic through them, and watching them break.

You place a load balancer, some API servers, a cache and a database on an
isometric floor, wire them together, and hit **Run Traffic**. Requests stream
through as visible packets. Overloaded components glow red, queues pile up,
dropped requests fall through the floor. The scoreboard gives you p99 latency,
error rate and cost per hour — and tells you which one you failed.

> **Status: engine works, board is editable, nothing is wired yet.** You can
> place, drag, stack and remove components on the grid, and the simulation
> scores a topology headlessly — but connecting components and running
> traffic in the app are the next phases. See
> [`docs/DESIGN.md`](docs/DESIGN.md) for the full design and build plan.

Today the engine already produces the arc the game is built on. One API
server against a ramp to 2,000 req/s:

```
1 API server   p99 2040ms   403 rps   61.6% errors   $3/hr   FAIL
3 API servers  p99 2040ms   961 rps    8.5% errors   $5/hr   FAIL
6 API servers  p99   50ms  1050 rps    0.0% errors   $8/hr   PASS
```

...with the failure explained rather than merely reported: *"19,407 requests
failed — API Server ran out of capacity and started shedding requests. Its
queue peaked at 800 waiting requests."*

## Running it

```bash
npm install
npm run dev
```

Other scripts: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.

## Layout

| Path | What lives there |
|---|---|
| `src/sim/` | Simulation engine — pure TypeScript, no React, no Three.js |
| `src/state/` | Zustand store: topology, run status, selection |
| `src/scene/` | react-three-fiber rendering |
| `src/levels/` | Levels, defined as plain data |
| `docs/DESIGN.md` | Design doc, component roster, phase plan |

The separation in that table is the project's one architectural rule: the
engine never imports the renderer. It keeps the simulation deterministic and
unit-testable, and it lets CI verify that every shipped level is actually
solvable. A lint rule enforces it.

## License

Apache 2.0 — see [LICENSE](LICENSE).

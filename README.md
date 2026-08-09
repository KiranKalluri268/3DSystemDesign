# Rack — a 3D system design game

Learn system design by building architectures out of blocks, running real
traffic through them, and watching them break.

You place a load balancer, some API servers, a cache and a database on an
isometric floor, wire them together, and hit **Run Traffic**. Requests stream
through as visible packets. Overloaded components glow red, queues pile up,
dropped requests fall through the floor. The scoreboard gives you p99 latency,
error rate and cost per hour — and tells you which one you failed.

> **Status: scaffold.** The board renders and the toolchain is wired up; the
> simulation engine and gameplay are the next phases. See
> [`docs/DESIGN.md`](docs/DESIGN.md) for the full design and build plan.

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

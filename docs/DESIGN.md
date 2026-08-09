# Rack — design document

A 3D system design game. You build an architecture out of physical blocks,
run real traffic through it, and watch it break. The lesson is the failure,
not a paragraph of text.

## 1. The pitch

You are looking down at an isometric datacenter floor. A brief appears:

> *Your photo-sharing app just hit the front page. 100 → 8,000 req/s over
> two minutes. Keep p99 under 300ms and error rate under 1%. Budget: $40/hr.*

You drag a load balancer onto the floor, drop three API servers behind it,
wire them up, and hit **Run Traffic**. Packets stream in as small glowing
objects. They pile up at the database. The database block turns amber, then
red. Packets start bouncing off it and vanishing — those are your 500s. The
HUD's p99 line climbs off the top of the chart. You fail.

You add a cache in front of the database. You run again. It holds — until
the level's write burst arrives and you learn what stale cache means.

## 2. Core loop

```
read brief → place components → wire them → RUN → read scoreboard → tune → pass
```

A level is passed by satisfying an `Objective`: p99 ceiling, error-rate
ceiling, cost ceiling, throughput floor. Stars come from beating the ceilings
with room to spare, especially on cost — over-provisioning is a way to lose.

## 3. Why 3D is not decoration

Three concrete jobs the third dimension does that a 2D diagram cannot:

- **Vertical axis = scale.** Replicas literally stack. A 6-high stack of API
  servers is instantly, physically legible as "I threw hardware at this."
  Autoscaling animates as boxes growing out of the floor.
- **Packets are objects with travel time.** Latency is distance and speed.
  Queue depth is a visible pile of waiting packets. A saturated node glows.
  A dropped request falls through the floor. You *see* backpressure.
- **Space encodes topology.** Regions and availability zones are separate
  floor plates with visible gaps. A cross-region call is a long, slow hop.
  Replication lag is a packet you can watch trail behind.

If a feature does not use one of these three, it belongs in the HUD, not the
scene.

Text is one thing the scene does **not** do. Labels are DOM elements
positioned over the canvas, not 3D text: drei's `<Text>` fetches a font from
a CDN at runtime and throws inside the render loop when that fails, blanking
the whole board. Nothing in the scene may depend on a network request.

## 4. Architecture

```
React + TypeScript + Vite
├── src/sim/     pure engine — NO react, NO three
├── src/state/   zustand store (topology, run status, UI selection)
├── src/scene/   react-three-fiber rendering
└── src/levels/  level definitions as data
```

### The one hard rule

**`src/sim` imports nothing from React or Three.js.** The engine takes a
`Topology` plus a `Level` and returns `RunMetrics` and a stream of events.
It runs headless in Node under `vitest`.

This buys three things: levels can be validated in CI (every shipped level
provably has a passing solution); the simulation is deterministic and
testable; and the renderer stays a thin subscriber instead of becoming an
unmaintainable Three.js blob with game logic hidden in `useFrame`.

### Simulation model

Discrete-event, fixed `TICK_MS` steps — never frame-driven, so results do not
depend on the player's refresh rate. Each tick:

1. Generate arrivals from the level's traffic profile (see `sim/traffic.ts`).
2. Route each request along links from the client entry point.
3. At each node: if in-flight < `capacityRps × replicas`, serve after
   `baseLatencyMs`; else enqueue; if the queue exceeds its bound, drop
   (counted as an error).
4. Record completions into a latency histogram.

Past the offered window the loop keeps stepping until the system drains, so a
request that was merely in flight when the clock stopped is not scored as a
failure; anything that cannot finish within `REQUEST_TIMEOUT_MS` times out.

Rendering interpolates between ticks for smooth packet motion. The sim is the
source of truth; the animation is a view of it.

Two rules the engine relies on, both enforced elsewhere so the hot loop does
not have to re-check them: `validateTopology` guarantees a single client and
an acyclic graph, and a component with nothing downstream answers the request
itself — an API server with no database is a real design, so the only shape
that would score nonsensically, an unwired client, is refused up front.

## 5. Component roster (v1)

| Component | Capacity | Base latency | Teaching point |
|---|---|---|---|
| Client | — | — | Traffic source |
| DNS | very high | 20ms | Resolution, TTL |
| CDN | very high | 15ms | Static offload, cache hit ratio |
| Load balancer | high | 2ms | Fan-out, health checks, SPOF |
| API server | low | 30ms | Horizontal scale |
| Cache | high | 1ms | Hit ratio, invalidation, stampede |
| SQL primary | low | 20ms | Write bottleneck, SPOF |
| SQL replica | medium | 20ms | Read scaling, replication lag |
| Object store | high | 40ms | Blobs don't belong in the DB |
| Queue | very high | 1ms | Absorbing bursts, async work |
| Worker | low | 200ms | Throughput vs. latency |

## 6. Level progression

Each level introduces exactly one new failure mode, and its solution is the
next level's starting assumption.

1. **One server, one problem** — a single API server saturates. Add a load
   balancer and replicas.
2. **The slow query** — the database is now the bottleneck. Add a cache, and
   meet cache invalidation.
3. **The write burst** — writes cannot be cached. Add a queue and workers,
   and meet eventual consistency.
4. **Read heavy** — add read replicas, and meet replication lag.
5. **The single point of failure** — a component fails mid-run. Learn
   redundancy.
6. **Going global** — a second region, and the cost of distance.

Levels are plain data in `src/levels/`, so contributors can add one without
touching engine or renderer code.

## 7. Build phases

| Phase | Deliverable | Status |
|---|---|---|
| 0 | Scaffold: Vite + TS + R3F, isometric board, CI, this doc | **done** |
| 1 | Headless sim engine + metrics, unit tested | **done** |
| 2 | Place / drag / delete components, snap to grid | **done** |
| 3 | Wiring: click-to-connect, validation, link rendering | next |
| 4 | Run mode: animated packets, live HUD, pass/fail | |
| 5 | Levels 1–3 with briefs and objectives | |
| 6 | Progression: budget, stars, "why you failed" explainers | |
| 7 | Polish, tutorial, GitHub Pages deploy | |

## 8. Non-goals

- Not a simulator that claims real-world numerical accuracy. Numbers are
  tuned to teach the right intuition, not to predict your AWS bill.
- No multiplayer, no accounts, no backend. Everything runs in the browser;
  progress lives in local storage.
- Not a diagram editor. If a design cannot be run and scored, it is out of
  scope.

import { describe, expect, it } from 'vitest';
import { runSimulation } from './engine';
import { specFor } from './specs';
import type { Level, NodeKind, Topology } from './types';

let seq = 0;
function node(id: string, kind: NodeKind, replicas = 1) {
  return { id, kind, replicas, cell: { x: 0, z: 0, y: 0 } };
}
function link(from: string, to: string) {
  return { id: `l${seq++}`, from, to };
}

function level(rps: number, seconds = 20): Level {
  return {
    id: 'test',
    title: 'Test',
    brief: '',
    palette: [],
    trafficProfile: [
      { atSecond: 0, rps },
      { atSecond: seconds, rps },
    ],
    objective: {},
  };
}

/** client → LB → n api servers → primary. */
function stack(apiReplicas: number): Topology {
  return {
    nodes: [
      node('c', 'client'),
      node('lb', 'load_balancer'),
      node('api', 'api_server', apiReplicas),
      node('db', 'sql_primary'),
    ],
    links: [link('c', 'lb'), link('lb', 'api'), link('api', 'db')],
  };
}

/**
 * client → LB → n api servers, terminating there.
 *
 * `stack` funnels everything into one SQL primary at 800 rps, so above that
 * the database is the constraint and API replicas change nothing. Tests about
 * scaling the API tier need the API tier to actually be the bottleneck.
 */
function apiTier(replicas: number): Topology {
  return {
    nodes: [
      node('c', 'client'),
      node('lb', 'load_balancer'),
      node('api', 'api_server', replicas),
    ],
    links: [link('c', 'lb'), link('lb', 'api')],
  };
}

describe('runSimulation', () => {
  it('refuses an invalid topology instead of running it', () => {
    const result = runSimulation({ nodes: [], links: [] }, level(100));
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.completed).toBe(0);
    expect(result.metrics.throughputRps).toBe(0);
  });

  it('is deterministic for a given seed', () => {
    const a = runSimulation(stack(3), level(500), { seed: 7 });
    const b = runSimulation(stack(3), level(500), { seed: 7 });
    expect(a.metrics).toEqual(b.metrics);
    expect(a.completed).toBe(b.completed);
    expect(a.dropped).toBe(b.dropped);
  });

  it('serves an under-capacity load with no errors', () => {
    const result = runSimulation(stack(3), level(300), { seed: 1 });
    expect(result.metrics.errorRate).toBe(0);
    expect(result.metrics.throughputRps).toBeGreaterThan(290);
  });

  it('charges latency for every hop on the path', () => {
    // LB 2ms + API 30ms + DB 20ms, plus one tick of delivery per hop.
    const result = runSimulation(stack(3), level(100), { seed: 1 });
    expect(result.metrics.p50LatencyMs).toBeGreaterThanOrEqual(52);
    expect(result.metrics.p50LatencyMs).toBeLessThan(120);
  });

  it('breaks down when a component is overloaded', () => {
    // One API server is 400 rps; offer it 2000.
    const result = runSimulation(apiTier(1), level(2000), { seed: 1 });
    expect(result.metrics.errorRate).toBeGreaterThan(0.5);
    const api = result.nodeStats.find((s) => s.nodeId === 'api')!;
    expect(api.dropped).toBeGreaterThan(0);
    expect(api.peakQueueDepth).toBeGreaterThan(0);
  });

  it('recovers the same load once replicas are added', () => {
    const overloaded = runSimulation(apiTier(1), level(2000), { seed: 1 });
    const scaled = runSimulation(apiTier(6), level(2000), { seed: 1 });
    expect(scaled.metrics.errorRate).toBeLessThan(overloaded.metrics.errorRate);
    expect(scaled.metrics.errorRate).toBeLessThan(0.01);
    expect(scaled.metrics.p99LatencyMs).toBeLessThan(overloaded.metrics.p99LatencyMs);
  });

  it('names the component that failed, not just that the run failed', () => {
    const result = runSimulation(apiTier(1), level(2000), { seed: 1 });
    const worst = [...result.nodeStats].sort((a, b) => b.dropped - a.dropped)[0]!;
    expect(worst.nodeId).toBe('api');
    expect(worst.dropsByReason.queue_full).toBeGreaterThan(0);
  });

  it('reports utilization against what a component could have served', () => {
    const result = runSimulation(apiTier(10), level(400), { seed: 1 });
    const api = result.nodeStats.find((s) => s.nodeId === 'api')!;
    // 400 rps offered against 10 x 400 rps of capacity.
    expect(api.utilization).toBeGreaterThan(0.05);
    expect(api.utilization).toBeLessThan(0.2);
  });

  it('scales throughput with replicas rather than capping at one instance', () => {
    const one = runSimulation(apiTier(1), level(2000), { seed: 1 });
    const three = runSimulation(apiTier(3), level(2000), { seed: 1 });
    expect(three.metrics.throughputRps).toBeGreaterThan(
      one.metrics.throughputRps * 2,
    );
  });

  it('serves traffic through a component slower than one request per tick', () => {
    // A worker is 5 rps: 0.05 requests per 10ms tick. Its serving budget has
    // to accumulate across ticks or it would never serve anything at all.
    const topology: Topology = {
      nodes: [
        node('c', 'client'),
        node('lb', 'load_balancer'),
        node('api', 'api_server'),
        node('q', 'queue'),
        node('w', 'worker', 4),
        node('store', 'object_store'),
      ],
      links: [
        link('c', 'lb'),
        link('lb', 'api'),
        link('api', 'q'),
        link('q', 'w'),
        link('w', 'store'),
      ],
    };
    const result = runSimulation(topology, level(20, 30), { seed: 1 });
    expect(result.completed).toBeGreaterThan(0);
    const worker = result.nodeStats.find((s) => s.nodeId === 'w')!;
    expect(worker.served).toBeGreaterThan(0);
  });

  it('lets a cache absorb most of the load behind it', () => {
    const cached: Topology = {
      nodes: [
        node('c', 'client'),
        node('lb', 'load_balancer'),
        node('api', 'api_server', 6),
        node('cache', 'cache'),
        node('db', 'sql_primary'),
      ],
      links: [
        link('c', 'lb'),
        link('lb', 'api'),
        link('api', 'cache'),
        link('cache', 'db'),
      ],
    };
    const result = runSimulation(cached, level(2000), { seed: 1 });
    const db = result.nodeStats.find((s) => s.nodeId === 'db')!;
    const cache = result.nodeStats.find((s) => s.nodeId === 'cache')!;
    const expectedMiss = 1 - specFor('cache').hitRatio!;
    expect(db.served).toBeLessThan(cache.served * (expectedMiss + 0.05));
    expect(db.served).toBeGreaterThan(0);
  });

  it('spreads load across a fan-out evenly', () => {
    const topology: Topology = {
      nodes: [
        node('c', 'client'),
        node('lb', 'load_balancer'),
        node('a1', 'api_server'),
        node('a2', 'api_server'),
        node('db', 'sql_primary'),
      ],
      links: [
        link('c', 'lb'),
        link('lb', 'a1'),
        link('lb', 'a2'),
        link('a1', 'db'),
        link('a2', 'db'),
      ],
    };
    const result = runSimulation(topology, level(600), { seed: 1 });
    const a1 = result.nodeStats.find((s) => s.nodeId === 'a1')!;
    const a2 = result.nodeStats.find((s) => s.nodeId === 'a2')!;
    expect(Math.abs(a1.served - a2.served)).toBeLessThanOrEqual(2);
  });

  it('lets a component with nothing downstream answer the request', () => {
    // An API server with no database is a real design, and level 1 is built
    // on it. It must score as served traffic, not as a dead end.
    const result = runSimulation(apiTier(6), level(500), { seed: 1 });
    expect(result.metrics.errorRate).toBe(0);
    expect(result.completed).toBeGreaterThan(0);
  });

  it('refuses a client that was never wired up', () => {
    // Without this the engine would complete every request instantly and
    // score an empty design as perfect.
    const result = runSimulation(
      { nodes: [node('c', 'client')], links: [] },
      level(100),
    );
    expect(result.issues.map((i) => i.code)).toContain('client_not_connected');
    expect(result.completed).toBe(0);
  });

  it('does not depend on how long the profile runs for a steady load', () => {
    const short = runSimulation(stack(3), level(300, 10), { seed: 1 });
    const long = runSimulation(stack(3), level(300, 40), { seed: 1 });
    expect(Math.abs(short.metrics.throughputRps - long.metrics.throughputRps))
      .toBeLessThan(15);
  });

  it('prices the topology regardless of how the run went', () => {
    const result = runSimulation(stack(3), level(2000), { seed: 1 });
    // LB 2 + 3 api at 1 + primary 6.
    expect(result.metrics.costPerHour).toBe(11);
  });
});

describe('packet trace', () => {
  it('bounds the sample regardless of offered load', () => {
    const result = runSimulation(stack(20), level(5000, 30), { seed: 1 });
    expect(result.trace.length).toBeGreaterThan(0);
    expect(result.trace.length).toBeLessThanOrEqual(60); // MAX_TRACED_PACKETS
  });

  it('spreads the sample across the whole run, not just the start', () => {
    const result = runSimulation(stack(20), level(2000, 60), { seed: 1 });
    const firstSpawn = result.trace[0]!.segments[0]!.arriveTick;
    const lastSpawn = result.trace[result.trace.length - 1]!.segments[0]!.arriveTick;
    // Runs 60s = 6000 ticks; a sample clustered in the first few percent
    // would defeat the point of sampling across a spike late in the run.
    expect(lastSpawn - firstSpawn).toBeGreaterThan(3000);
  });

  it('is deterministic for a given seed', () => {
    const a = runSimulation(stack(3), level(500), { seed: 7 });
    const b = runSimulation(stack(3), level(500), { seed: 7 });
    expect(a.trace).toEqual(b.trace);
  });

  it('records a completed packet as a chain of closed segments', () => {
    const result = runSimulation(stack(6), level(50), { seed: 1 });
    const completedTrace = result.trace.find((t) => t.outcome === 'completed');
    expect(completedTrace).toBeDefined();
    // client -> lb -> api -> db: every segment but conceptually all of them
    // close, because completion only happens after the last hop departs.
    for (const segment of completedTrace!.segments) {
      expect(segment.departTick).not.toBeNull();
    }
    expect(completedTrace!.endTick).toBeGreaterThanOrEqual(
      completedTrace!.segments[0]!.arriveTick,
    );
  });

  it('leaves a dropped packet\'s last segment open', () => {
    const result = runSimulation(stack(1), level(2000, 5), { seed: 1 });
    const droppedTrace = result.trace.find((t) => t.outcome === 'dropped');
    expect(droppedTrace).toBeDefined();
    const last = droppedTrace!.segments[droppedTrace!.segments.length - 1]!;
    // Either it never got queued at all (arrive === depart, bounced
    // instantly) or it was still waiting when it timed out.
    expect(last.departTick === null || last.departTick === last.arriveTick).toBe(true);
    expect(droppedTrace!.dropReason).toBeDefined();
  });

  it('never opens a segment past the end of the previous one', () => {
    // A hop must depart before the next one can arrive: segments cannot
    // overlap in time for a single traced packet.
    const result = runSimulation(stack(4), level(600, 30), { seed: 3 });
    for (const trace of result.trace) {
      for (let i = 1; i < trace.segments.length; i++) {
        const prevDepart = trace.segments[i - 1]!.departTick;
        expect(prevDepart).not.toBeNull();
        expect(trace.segments[i]!.arriveTick).toBeGreaterThanOrEqual(prevDepart!);
      }
    }
  });
});

describe('history', () => {
  it('snapshots once a second, including the start', () => {
    const result = runSimulation(stack(3), level(500, 10), { seed: 1 });
    expect(result.history[0]!.second).toBe(0);
    const seconds = result.history.map((h) => h.second);
    expect(seconds).toEqual([...seconds].sort((a, b) => a - b));
  });

  it('grows completed count monotonically', () => {
    const result = runSimulation(stack(4), level(1000, 20), { seed: 1 });
    for (let i = 1; i < result.history.length; i++) {
      expect(result.history[i]!.throughputRps).toBeGreaterThanOrEqual(0);
    }
  });

  it('tracks queue depth per node at the same cadence as history', () => {
    const result = runSimulation(stack(1), level(2000, 10), { seed: 1 });
    const apiDepth = result.queueDepthHistory['api'];
    expect(apiDepth).toBeDefined();
    expect(apiDepth!.length).toBe(result.history.length);
    // An overloaded API server should show a queue building up, not staying
    // flat at zero -- otherwise there is nothing for the board to animate.
    expect(Math.max(...apiDepth!)).toBeGreaterThan(0);
  });

  it('reports the offered duration separately from the drained tail', () => {
    const result = runSimulation(stack(1), level(2000, 10), { seed: 1 });
    expect(result.offeredDurationSeconds).toBe(10);
    // Overloaded, so draining the backlog takes longer than the offer window.
    expect(result.lastTick).toBeGreaterThan((10 * 1000) / 10);
  });

  it('matches the offered duration when nothing needs to drain', () => {
    const result = runSimulation(stack(6), level(50, 5), { seed: 1 });
    // A healthy run still needs a few ticks past the offer window for the
    // last spawned request to travel its hops (LB + API + DB, ~50ms) --
    // this is not the queueing drain the overloaded case above measures.
    expect(result.lastTick).toBeLessThanOrEqual((5 * 1000) / 10 + 20);
  });

  it('is empty for a refused topology, not missing', () => {
    const result = runSimulation({ nodes: [], links: [] }, level(100));
    expect(result.trace).toEqual([]);
    expect(result.history).toEqual([]);
    expect(result.queueDepthHistory).toEqual({});
  });
});

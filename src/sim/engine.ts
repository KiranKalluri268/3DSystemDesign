import { MAX_QUEUE_SECONDS, REQUEST_TIMEOUT_MS, TICK_MS } from './constants';
import { LatencyHistogram } from './histogram';
import { createRng } from './rng';
import { costPerHour, specFor } from './specs';
import { offeredRpsAt } from './traffic';
import { validateTopology } from './validate';
import type { Level, PlacedNode, RunMetrics, Topology } from './types';

export type DropReason = 'queue_full' | 'timeout';

/** Per-component outcome, for the HUD and for "why you failed" explainers. */
export interface NodeStats {
  nodeId: string;
  served: number;
  dropped: number;
  dropsByReason: Record<DropReason, number>;
  peakQueueDepth: number;
  /** Served requests as a fraction of what the component could have served. */
  utilization: number;
}

export interface RunResult {
  metrics: RunMetrics;
  nodeStats: NodeStats[];
  completed: number;
  dropped: number;
  /** Non-empty means nothing ran; the topology was refused. */
  issues: ReturnType<typeof validateTopology>;
}

export interface RunOptions {
  /** Same seed plus same topology must give the same result. */
  seed?: number;
  /** Overrides the duration implied by the level's traffic profile. */
  durationSeconds?: number;
}

interface Request {
  spawnTick: number;
}

/** A request in transit, due to arrive at `nodeId` (or to finish, if null). */
interface InFlight {
  request: Request;
  nodeId: string | null;
}

interface NodeState {
  node: PlacedNode;
  queue: Request[];
  maxQueue: number;
  capacityPerTick: number;
  /** Fractional serving capacity carried between ticks. */
  budget: number;
  targets: string[];
  roundRobin: number;
  stats: NodeStats;
}

/**
 * Run a topology against a level's traffic profile.
 *
 * Fixed-step discrete time: the loop advances by TICK_MS regardless of how
 * fast anything renders, so a result depends only on the topology and the
 * seed. The renderer interpolates between ticks; it never drives them.
 */
export function runSimulation(
  topology: Topology,
  level: Level,
  options: RunOptions = {},
): RunResult {
  const issues = validateTopology(topology);
  if (issues.length > 0) return refused(issues, topology);

  const rng = createRng(options.seed ?? 1);
  const durationSeconds = options.durationSeconds ?? profileDuration(level);
  const totalTicks = Math.ceil((durationSeconds * 1000) / TICK_MS);
  const dt = TICK_MS / 1000;

  const states = buildStates(topology);
  const client = [...states.values()].find((s) => s.node.kind === 'client')!;

  const latencies = new LatencyHistogram();
  const arrivals = new Map<number, InFlight[]>();
  let completed = 0;
  let dropped = 0;
  /** Fractional request carried between ticks, so 150 rps is not 100 or 200. */
  let spawnCarry = 0;

  const drop = (state: NodeState, reason: DropReason): void => {
    dropped += 1;
    state.stats.dropped += 1;
    state.stats.dropsByReason[reason] += 1;
  };

  const deliver = (tick: number, item: InFlight): void => {
    const { request } = item;
    if (item.nodeId === null) {
      // Reached the end of its path: the response is complete.
      completed += 1;
      latencies.record((tick - request.spawnTick) * TICK_MS);
      return;
    }
    const state = states.get(item.nodeId)!;
    if ((tick - request.spawnTick) * TICK_MS >= REQUEST_TIMEOUT_MS) {
      drop(state, 'timeout');
      return;
    }
    if (state.queue.length >= state.maxQueue) {
      drop(state, 'queue_full');
      return;
    }
    state.queue.push(request);
    state.stats.peakQueueDepth = Math.max(
      state.stats.peakQueueDepth,
      state.queue.length,
    );
  };

  const schedule = (tick: number, item: InFlight): void => {
    const bucket = arrivals.get(tick);
    if (bucket) bucket.push(item);
    else arrivals.set(tick, [item]);
  };

  // Past the offered window the loop keeps running until everything still in
  // the system has finished, so requests that were merely in flight when the
  // clock stopped are not scored as failures. Anything that cannot drain
  // inside one timeout was genuinely stuck and times out on its own.
  const hardStop = totalTicks + REQUEST_TIMEOUT_MS / TICK_MS;
  const idle = (): boolean =>
    arrivals.size === 0 && [...states.values()].every((s) => s.queue.length === 0);

  for (let tick = 0; tick <= hardStop; tick++) {
    // 1. New requests enter at the client.
    if (tick < totalTicks) {
      spawnCarry += offeredRpsAt(level.trafficProfile, (tick * TICK_MS) / 1000) * dt;
      const count = Math.floor(spawnCarry);
      spawnCarry -= count;
      for (let i = 0; i < count; i++) {
        deliver(tick, { request: { spawnTick: tick }, nodeId: client.node.id });
      }
    } else if (idle()) {
      break;
    }

    // 2. Requests in transit that land on this tick.
    const landing = arrivals.get(tick);
    if (landing) {
      arrivals.delete(tick);
      for (const item of landing) deliver(tick, item);
    }

    // 3. Every component serves what its capacity allows this tick.
    for (const state of states.values()) {
      // Idle capacity does not bank indefinitely — a component cannot save up
      // a quiet minute and then absorb a spike. The floor of 1 matters: a
      // worker at 5 rps earns 0.05 per tick, so capping at one tick's worth
      // would leave it permanently below the threshold to serve anything.
      state.budget = Math.min(
        state.budget + state.capacityPerTick,
        Math.max(state.capacityPerTick, 1),
      );
      while (state.budget >= 1 && state.queue.length > 0) {
        const request = state.queue.shift()!;
        state.budget -= 1;
        state.stats.served += 1;

        const next = chooseTarget(state, rng);
        const spec = specFor(state.node.kind);
        const delay = Math.max(1, Math.round(spec.baseLatencyMs / TICK_MS));
        schedule(tick + delay, { request, nodeId: next });
      }
    }
  }

  // Anything still queued or in transit when time runs out never answered.
  for (const state of states.values()) {
    for (let i = 0; i < state.queue.length; i++) drop(state, 'timeout');
    state.queue.length = 0;
  }
  for (const bucket of arrivals.values()) {
    for (const item of bucket) {
      if (item.nodeId === null) continue;
      drop(states.get(item.nodeId)!, 'timeout');
    }
  }

  const nodeStats = [...states.values()].map((state) => {
    const servable = state.capacityPerTick * totalTicks;
    return {
      ...state.stats,
      utilization: servable > 0 && Number.isFinite(servable)
        ? state.stats.served / servable
        : 0,
    };
  });

  const offered = completed + dropped;
  return {
    metrics: {
      p50LatencyMs: Math.round(latencies.percentile(0.5)),
      p99LatencyMs: Math.round(latencies.percentile(0.99)),
      throughputRps: durationSeconds > 0 ? completed / durationSeconds : 0,
      errorRate: offered > 0 ? dropped / offered : 0,
      costPerHour: costPerHour(topology.nodes),
    },
    nodeStats,
    completed,
    dropped,
    issues,
  };
}

/**
 * Which downstream component gets this request, or null if it finishes here.
 *
 * Round robin, so a load balancer spreads across its replicas evenly and
 * predictably. Nodes with a hit ratio answer that fraction themselves — a
 * cache hit — and forward the rest.
 *
 * A component with nothing downstream answers the request itself. That is not
 * only true of terminal stores: an API server serving a static response with
 * no database behind it is a legitimate design, and level 1 is built on it.
 * The one shape this would score nonsensically — a lone client wired to
 * nothing, completing every request instantly — is refused by validation
 * before the engine sees it.
 */
function chooseTarget(state: NodeState, rng: { next(): number }): string | null {
  const spec = specFor(state.node.kind);
  if (spec.hitRatio !== undefined && rng.next() < spec.hitRatio) return null;
  if (state.targets.length === 0) return null;
  const target = state.targets[state.roundRobin % state.targets.length]!;
  state.roundRobin += 1;
  return target;
}

function buildStates(topology: Topology): Map<string, NodeState> {
  const states = new Map<string, NodeState>();
  for (const node of topology.nodes) {
    const spec = specFor(node.kind);
    const capacity = spec.capacityRps * node.replicas;
    states.set(node.id, {
      node,
      queue: [],
      maxQueue: Number.isFinite(capacity)
        ? Math.max(1, Math.ceil(capacity * MAX_QUEUE_SECONDS))
        : Number.MAX_SAFE_INTEGER,
      capacityPerTick: (capacity * TICK_MS) / 1000,
      budget: 0,
      targets: topology.links.filter((l) => l.from === node.id).map((l) => l.to),
      roundRobin: 0,
      stats: {
        nodeId: node.id,
        served: 0,
        dropped: 0,
        dropsByReason: { queue_full: 0, timeout: 0 },
        peakQueueDepth: 0,
        utilization: 0,
      },
    });
  }
  return states;
}

function profileDuration(level: Level): number {
  const last = level.trafficProfile[level.trafficProfile.length - 1];
  return last ? last.atSecond : 0;
}

function refused(
  issues: ReturnType<typeof validateTopology>,
  topology: Topology,
): RunResult {
  return {
    metrics: {
      p50LatencyMs: 0,
      p99LatencyMs: 0,
      throughputRps: 0,
      errorRate: 0,
      costPerHour: costPerHour(topology.nodes),
    },
    nodeStats: [],
    completed: 0,
    dropped: 0,
    issues,
  };
}

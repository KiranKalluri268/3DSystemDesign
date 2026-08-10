import { beforeEach, describe, expect, it } from 'vitest';
import { useRun } from './runStore';
import { SANDBOX_LEVEL } from '../levels/sandbox';
import { LEVEL_1 } from '../levels/level1';
import type { NodeKind, Topology } from '../sim/types';

const state = () => useRun.getState();

function node(id: string, kind: NodeKind, replicas = 1): Topology['nodes'][number] {
  return { id, kind, replicas, cell: { x: 0, z: 0, y: 0 } };
}
function link(id: string, from: string, to: string) {
  return { id, from, to };
}

/** A healthy, generously scaled topology, so a real run has something to play back. */
function healthyTopology(): Topology {
  return {
    nodes: [
      node('c', 'client'),
      node('lb', 'load_balancer'),
      node('api', 'api_server', 8),
      node('cache', 'cache'),
      node('db', 'sql_primary', 2),
    ],
    links: [
      link('l1', 'c', 'lb'),
      link('l2', 'lb', 'api'),
      link('l3', 'api', 'cache'),
      link('l4', 'cache', 'db'),
    ],
  };
}

describe('run store', () => {
  beforeEach(() => state().reset());

  it('starts idle', () => {
    expect(state().status).toBe('editing');
    expect(state().result).toBeNull();
  });

  it('runs the given topology and enters playback', () => {
    state().start(healthyTopology(), SANDBOX_LEVEL);
    expect(state().status).toBe('running');
    expect(state().result).not.toBeNull();
    expect(state().verdict).not.toBeNull();
    expect(state().playbackTick).toBe(0);
  });

  it('goes straight to finished for a topology the engine refuses', () => {
    state().start({ nodes: [node('c', 'client')], links: [] }, SANDBOX_LEVEL);
    expect(state().status).toBe('finished');
    expect(state().verdict?.passed).toBe(false);
    expect(state().verdict?.explanation).toContain('Connect the client');
  });

  it('advances playback proportional to speed', () => {
    state().start(healthyTopology(), SANDBOX_LEVEL);
    state().setSpeed(1);
    const before = state().playbackTick;
    state().advance(1); // one real second at 1x = 100 ticks (TICK_MS=10)
    expect(state().playbackTick - before).toBeCloseTo(100);
  });

  it('does not advance while not running', () => {
    state().advance(5); // no run started
    expect(state().playbackTick).toBe(0);
  });

  it('clamps to the end and finishes rather than overshooting', () => {
    state().start(healthyTopology(), SANDBOX_LEVEL);
    const lastTick = state().result!.lastTick;
    state().advance(1_000_000); // absurdly large jump
    expect(state().playbackTick).toBe(lastTick);
    expect(state().status).toBe('finished');
  });

  it('returns to editing on reset, discarding the result', () => {
    state().start(healthyTopology(), SANDBOX_LEVEL);
    state().reset();
    expect(state().status).toBe('editing');
    expect(state().result).toBeNull();
    expect(state().topology).toBeNull();
    expect(state().playbackTick).toBe(0);
  });

  it('is deterministic: the same topology gives the same verdict every run', () => {
    state().start(healthyTopology(), SANDBOX_LEVEL);
    const first = state().result!.metrics;
    state().reset();
    state().start(healthyTopology(), SANDBOX_LEVEL);
    const second = state().result!.metrics;
    expect(second).toEqual(first);
  });

  it('freezes a snapshot of the topology used for the run', () => {
    const topology = healthyTopology();
    state().start(topology, SANDBOX_LEVEL);
    expect(state().topology).toEqual(topology);
  });

  it('runs against whichever level is passed, not a hardcoded one', () => {
    // The sandbox ramps to 8,000 rps over 120s; level 1 ramps to 2,500 over
    // 60s. If start() ignored its level argument, both runs would offer the
    // same duration.
    state().start(healthyTopology(), SANDBOX_LEVEL);
    const sandboxDuration = state().result!.offeredDurationSeconds;
    state().reset();
    state().start(healthyTopology(), LEVEL_1);
    const level1Duration = state().result!.offeredDurationSeconds;

    expect(level1Duration).not.toBe(sandboxDuration);
    expect(level1Duration).toBe(60);
  });
});

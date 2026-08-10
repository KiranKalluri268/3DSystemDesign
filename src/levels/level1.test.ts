import { describe, expect, it } from 'vitest';
import { runSimulation } from '../sim/engine';
import { scoreRun } from '../sim/score';
import { MAX_REPLICAS } from '../state/topology';
import { LEVEL_1 } from './level1';
import type { Topology } from '../sim/types';

function node(id: string, kind: Topology['nodes'][number]['kind'], replicas = 1) {
  return { id, kind, replicas, cell: { x: 0, z: 0, y: 0 } };
}
function link(id: string, from: string, to: string) {
  return { id, from, to };
}

function apiTier(replicas: number): Topology {
  return {
    nodes: [
      node('c', 'client'),
      node('lb', 'load_balancer'),
      node('api', 'api_server', replicas),
    ],
    links: [link('l1', 'c', 'lb'), link('l2', 'lb', 'api')],
  };
}

describe('level 1', () => {
  it('is solvable within the replica cap the board UI actually enforces', () => {
    const topology = apiTier(7);
    expect(topology.nodes[2]!.replicas).toBeLessThanOrEqual(MAX_REPLICAS);

    const result = runSimulation(topology, LEVEL_1, { seed: 1 });
    const verdict = scoreRun(result, LEVEL_1, topology);

    expect(verdict.passed).toBe(true);
  });

  it('fails a single server outright', () => {
    // The level's entire premise: one instance cannot take this traffic.
    const result = runSimulation(apiTier(1), LEVEL_1, { seed: 1 });
    const verdict = scoreRun(result, LEVEL_1, apiTier(1));
    expect(verdict.passed).toBe(false);
  });

  it('fails a design that is close but under-scaled', () => {
    // Proves the objective actually bites -- not so loose that anything
    // reasonable passes.
    const result = runSimulation(apiTier(5), LEVEL_1, { seed: 1 });
    const verdict = scoreRun(result, LEVEL_1, apiTier(5));
    expect(verdict.passed).toBe(false);
  });

  it('only allows the level\'s own components', () => {
    expect(LEVEL_1.palette).toEqual(['client', 'load_balancer', 'api_server']);
  });
});

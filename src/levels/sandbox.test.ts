import { describe, expect, it } from 'vitest';
import { runSimulation } from '../sim/engine';
import { scoreRun } from '../sim/score';
import { MAX_REPLICAS } from '../state/topology';
import { SANDBOX_LEVEL } from './sandbox';
import type { Topology } from '../sim/types';

/**
 * The sandbox scenario is scaffolding, not a shipped level, but it lives in
 * src/levels and CLAUDE.md's rule is exactly this: nothing here ships
 * without a proven reference solution. This one is built entirely within
 * MAX_REPLICAS, the real cap the board UI enforces per node — three sibling
 * API server nodes rather than one node with more instances than a player
 * could ever place, because a solution only the engine can reach isn't one
 * a player can find.
 */
function referenceSolution(): Topology {
  const node = (id: string, kind: Topology['nodes'][number]['kind'], replicas = 1) => ({
    id,
    kind,
    replicas,
    cell: { x: 0, z: 0, y: 0 },
  });
  const link = (id: string, from: string, to: string) => ({ id, from, to });

  return {
    nodes: [
      node('client', 'client'),
      node('lb', 'load_balancer'),
      node('api1', 'api_server', 7),
      node('api2', 'api_server', 7),
      node('api3', 'api_server', 7),
      node('cache', 'cache'),
      node('db', 'sql_primary', 2),
    ],
    links: [
      link('l1', 'client', 'lb'),
      link('l2', 'lb', 'api1'),
      link('l3', 'lb', 'api2'),
      link('l4', 'lb', 'api3'),
      link('l5', 'api1', 'cache'),
      link('l6', 'api2', 'cache'),
      link('l7', 'api3', 'cache'),
      link('l8', 'cache', 'db'),
    ],
  };
}

describe('sandbox level', () => {
  it('is solvable within the replica cap the board UI actually enforces', () => {
    const topology = referenceSolution();
    for (const node of topology.nodes) {
      expect(node.replicas).toBeLessThanOrEqual(MAX_REPLICAS);
    }

    const result = runSimulation(topology, SANDBOX_LEVEL, { seed: 1 });
    const verdict = scoreRun(result, SANDBOX_LEVEL, topology);

    expect(verdict.passed).toBe(true);
    expect(result.metrics.costPerHour).toBeLessThanOrEqual(
      SANDBOX_LEVEL.objective.maxCostPerHour!,
    );
  });

  it('fails the same shape scaled down, so the level is not trivially easy', () => {
    const topology = referenceSolution();
    // Halve the API tier: 3 nodes of 3 instead of 7 replicas each.
    for (const node of topology.nodes) {
      if (node.kind === 'api_server') node.replicas = 3;
    }
    const result = runSimulation(topology, SANDBOX_LEVEL, { seed: 1 });
    const verdict = scoreRun(result, SANDBOX_LEVEL, topology);
    expect(verdict.passed).toBe(false);
  });
});

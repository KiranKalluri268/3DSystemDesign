import { describe, expect, it } from 'vitest';
import { runSimulation } from '../sim/engine';
import { scoreRun } from '../sim/score';
import { MAX_REPLICAS } from '../state/topology';
import { LEVEL_2 } from './level2';
import type { Topology } from '../sim/types';

function node(id: string, kind: Topology['nodes'][number]['kind'], replicas = 1) {
  return { id, kind, replicas, cell: { x: 0, z: 0, y: 0 } };
}
function link(id: string, from: string, to: string) {
  return { id, from, to };
}

function withCache(apiReplicas: number, dbReplicas: number): Topology {
  return {
    nodes: [
      node('c', 'client'),
      node('lb', 'load_balancer'),
      node('api', 'api_server', apiReplicas),
      node('cache', 'cache'),
      node('db', 'sql_primary', dbReplicas),
    ],
    links: [
      link('l1', 'c', 'lb'),
      link('l2', 'lb', 'api'),
      link('l3', 'api', 'cache'),
      link('l4', 'cache', 'db'),
    ],
  };
}

function withoutCache(apiReplicas: number, dbReplicas: number): Topology {
  return {
    nodes: [
      node('c', 'client'),
      node('lb', 'load_balancer'),
      node('api', 'api_server', apiReplicas),
      node('db', 'sql_primary', dbReplicas),
    ],
    links: [link('l1', 'c', 'lb'), link('l2', 'lb', 'api'), link('l3', 'api', 'db')],
  };
}

describe('level 2', () => {
  it('is solvable within the replica cap the board UI actually enforces', () => {
    const topology = withCache(7, 1);
    for (const node of topology.nodes) {
      expect(node.replicas).toBeLessThanOrEqual(MAX_REPLICAS);
    }

    const result = runSimulation(topology, LEVEL_2, { seed: 1 });
    const verdict = scoreRun(result, LEVEL_2, topology);

    expect(verdict.passed).toBe(true);
  });

  it('fails the identical API tier without a cache in front of the database', () => {
    // The level's entire premise: the API tier from level 1 is not the
    // problem here -- the database is, and only a cache fixes that.
    const topology = withoutCache(7, 1);
    const result = runSimulation(topology, LEVEL_2, { seed: 1 });
    const verdict = scoreRun(result, LEVEL_2, topology);

    expect(verdict.passed).toBe(false);
    expect(verdict.explanation).toContain('SQL Primary');
  });

  it('fails an under-scaled API tier even with a cache present', () => {
    // A cache does not fix a bottleneck upstream of it.
    const topology = withCache(3, 1);
    const result = runSimulation(topology, LEVEL_2, { seed: 1 });
    const verdict = scoreRun(result, LEVEL_2, topology);

    expect(verdict.passed).toBe(false);
    expect(verdict.explanation).toContain('API Server');
  });

  it('only allows the level\'s own components', () => {
    expect(LEVEL_2.palette).toEqual([
      'client',
      'load_balancer',
      'api_server',
      'cache',
      'sql_primary',
    ]);
  });
});

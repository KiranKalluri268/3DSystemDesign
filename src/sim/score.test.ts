import { describe, expect, it } from 'vitest';
import { runSimulation } from './engine';
import { scoreRun } from './score';
import type { Level, NodeKind, Objective, Topology } from './types';

let seq = 0;
function node(id: string, kind: NodeKind, replicas = 1) {
  return { id, kind, replicas, cell: { x: 0, z: 0, y: 0 } };
}
function link(from: string, to: string) {
  return { id: `l${seq++}`, from, to };
}

function level(rps: number, objective: Objective, seconds = 20): Level {
  return {
    id: 'test',
    title: 'Test',
    brief: '',
    palette: [],
    trafficProfile: [
      { atSecond: 0, rps },
      { atSecond: seconds, rps },
    ],
    objective,
  };
}

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

function score(topology: Topology, lvl: Level) {
  return scoreRun(runSimulation(topology, lvl, { seed: 1 }), lvl, topology);
}

describe('scoreRun', () => {
  it('passes a design that meets every objective', () => {
    const lvl = level(500, { maxErrorRate: 0.01, maxP99LatencyMs: 500 });
    const verdict = score(apiTier(4), lvl);
    expect(verdict.passed).toBe(true);
    expect(verdict.objectives.every((o) => o.passed)).toBe(true);
    expect(verdict.explanation).toBe('');
  });

  it('only checks the objectives a level actually sets', () => {
    const verdict = score(apiTier(4), level(500, { maxErrorRate: 0.01 }));
    expect(verdict.objectives.map((o) => o.key)).toEqual(['maxErrorRate']);
  });

  it('reports the measured value alongside the target', () => {
    const lvl = level(2000, { maxErrorRate: 0.01 });
    const verdict = score(apiTier(1), lvl);
    const errors = verdict.objectives.find((o) => o.key === 'maxErrorRate')!;
    expect(errors.passed).toBe(false);
    expect(errors.target).toBe(0.01);
    expect(errors.actual).toBeGreaterThan(0.5);
  });

  it('fails a design that busts its budget even when it performs', () => {
    const lvl = level(500, { maxErrorRate: 0.01, maxCostPerHour: 3 });
    const verdict = score(apiTier(10), lvl);
    expect(verdict.passed).toBe(false);
    expect(verdict.explanation).toContain('Over-provisioning');
  });

  it('names the component responsible for the failure', () => {
    const verdict = score(apiTier(1), level(2000, { maxErrorRate: 0.01 }));
    expect(verdict.explanation).toContain('API Server');
    expect(verdict.explanation).toMatch(/capacity|timed out/);
  });

  it('quotes the queue depth so the failure is legible', () => {
    const verdict = score(apiTier(1), level(2000, { maxErrorRate: 0.01 }));
    expect(verdict.explanation).toMatch(/queue peaked at [\d,]+/);
  });

  it('explains an invalid topology instead of scoring it', () => {
    const verdict = score(
      { nodes: [node('c', 'client')], links: [] },
      level(100, { maxErrorRate: 0.01 }),
    );
    expect(verdict.passed).toBe(false);
    expect(verdict.explanation).toContain('Connect the client');
    expect(verdict.objectives).toEqual([]);
  });

  it('never leaves a failure unexplained', () => {
    const cases: Array<[Topology, Level]> = [
      [apiTier(1), level(2000, { maxErrorRate: 0.01 })],
      [apiTier(10), level(500, { maxCostPerHour: 1 })],
      [apiTier(1), level(2000, { minThroughputRps: 1900 })],
      [apiTier(1), level(2000, { maxP99LatencyMs: 50 })],
    ];
    for (const [topology, lvl] of cases) {
      const verdict = score(topology, lvl);
      expect(verdict.passed).toBe(false);
      expect(verdict.explanation.length).toBeGreaterThan(40);
    }
  });

  it('writes for a player, not for a console', () => {
    const verdict = score(apiTier(1), level(2000, { maxErrorRate: 0.01 }));
    expect(verdict.explanation).not.toMatch(/capacityRps|nodeId|undefined|NaN/);
  });
});

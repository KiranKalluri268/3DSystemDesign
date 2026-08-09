import { describe, expect, it } from 'vitest';
import { NODE_SPECS, costPerHour, specFor } from './specs';
import type { NodeKind } from './types';

const kinds = Object.keys(NODE_SPECS) as NodeKind[];

describe('NODE_SPECS', () => {
  it('keys every spec by its own kind', () => {
    for (const kind of kinds) {
      expect(NODE_SPECS[kind].kind).toBe(kind);
    }
  });

  it('only allows connections to kinds that exist', () => {
    for (const kind of kinds) {
      for (const target of NODE_SPECS[kind].canConnectTo) {
        expect(kinds).toContain(target);
      }
    }
  });

  it('gives every spec a usable capacity and a non-negative cost', () => {
    for (const kind of kinds) {
      const spec = specFor(kind);
      expect(spec.capacityRps).toBeGreaterThan(0);
      expect(spec.baseLatencyMs).toBeGreaterThanOrEqual(0);
      expect(spec.costPerHour).toBeGreaterThanOrEqual(0);
    }
  });

  it('keeps hit ratios a fraction', () => {
    for (const kind of kinds) {
      const ratio = specFor(kind).hitRatio;
      if (ratio !== undefined) {
        expect(ratio).toBeGreaterThan(0);
        expect(ratio).toBeLessThanOrEqual(1);
      }
    }
  });

  it('never lets a terminal store forward traffic onward', () => {
    // A request has to end somewhere, or the engine would route in circles.
    expect(specFor('sql_primary').canConnectTo).toEqual([]);
    expect(specFor('sql_replica').canConnectTo).toEqual([]);
    expect(specFor('object_store').canConnectTo).toEqual([]);
  });

  describe('the intuitions levels are built on', () => {
    it('makes an API server saturate long before its load balancer', () => {
      expect(specFor('load_balancer').capacityRps).toBeGreaterThan(
        specFor('api_server').capacityRps * 10,
      );
    });

    it('makes the cache an order of magnitude faster than the database', () => {
      expect(specFor('cache').baseLatencyMs * 10).toBeLessThan(
        specFor('sql_primary').baseLatencyMs,
      );
    });

    it('gives a replica more read capacity than the primary', () => {
      expect(specFor('sql_replica').capacityRps).toBeGreaterThan(
        specFor('sql_primary').capacityRps,
      );
    });

    it('makes a worker slow but cheap', () => {
      expect(specFor('worker').baseLatencyMs).toBeGreaterThan(
        specFor('api_server').baseLatencyMs,
      );
      expect(specFor('worker').costPerHour).toBeLessThan(
        specFor('api_server').costPerHour,
      );
    });
  });
});

describe('costPerHour', () => {
  it('is zero for an empty topology', () => {
    expect(costPerHour([])).toBe(0);
  });

  it('charges for every replica', () => {
    const one = costPerHour([{ kind: 'api_server', replicas: 1 }]);
    const four = costPerHour([{ kind: 'api_server', replicas: 4 }]);
    expect(four).toBe(one * 4);
  });

  it('sums across kinds and rounds to cents', () => {
    const total = costPerHour([
      { kind: 'load_balancer', replicas: 1 }, // 2
      { kind: 'api_server', replicas: 3 }, // 3
      { kind: 'sql_primary', replicas: 1 }, // 6
      { kind: 'worker', replicas: 3 }, // 1.5
    ]);
    expect(total).toBe(12.5);
  });

  it('does not charge for the client', () => {
    expect(costPerHour([{ kind: 'client', replicas: 1 }])).toBe(0);
  });
});

import { describe, expect, it } from 'vitest';
import { LatencyHistogram } from './histogram';

function filled(values: number[]): LatencyHistogram {
  const h = new LatencyHistogram();
  for (const v of values) h.record(v);
  return h;
}

describe('LatencyHistogram', () => {
  it('reports zero for an empty histogram', () => {
    const h = new LatencyHistogram();
    expect(h.count).toBe(0);
    expect(h.percentile(0.99)).toBe(0);
    expect(h.mean()).toBe(0);
  });

  it('computes nearest-rank percentiles', () => {
    const h = filled([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(h.percentile(0.5)).toBe(5);
    expect(h.percentile(0.9)).toBe(9);
    expect(h.percentile(1)).toBe(10);
  });

  it('does not depend on insertion order', () => {
    const ascending = filled([10, 20, 30, 40, 50]);
    const shuffled = filled([30, 50, 10, 40, 20]);
    expect(shuffled.percentile(0.5)).toBe(ascending.percentile(0.5));
    expect(shuffled.percentile(0.99)).toBe(ascending.percentile(0.99));
  });

  it('catches a tail that the mean hides', () => {
    // 99 fast requests and one very slow one: a healthy mean, a broken p99.
    const h = filled([...new Array<number>(99).fill(10), 5000]);
    expect(h.mean()).toBeLessThan(60);
    expect(h.percentile(0.99)).toBe(10);
    expect(h.percentile(1)).toBe(5000);
  });

  it('stays correct when samples are added after a percentile read', () => {
    const h = filled([1, 2, 3]);
    expect(h.percentile(1)).toBe(3);
    h.record(100);
    expect(h.percentile(1)).toBe(100);
    expect(h.count).toBe(4);
  });
});

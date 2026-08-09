import { describe, expect, it } from 'vitest';
import { offeredRpsAt } from './traffic';

const spike = [
  { atSecond: 0, rps: 100 },
  { atSecond: 10, rps: 1000 },
  { atSecond: 20, rps: 100 },
];

describe('offeredRpsAt', () => {
  it('returns 0 for an empty profile', () => {
    expect(offeredRpsAt([], 5)).toBe(0);
  });

  it('holds the first value before the profile starts', () => {
    expect(offeredRpsAt(spike, -3)).toBe(100);
  });

  it('holds the last value after the profile ends', () => {
    expect(offeredRpsAt(spike, 999)).toBe(100);
  });

  it('hits waypoints exactly', () => {
    expect(offeredRpsAt(spike, 10)).toBe(1000);
  });

  it('interpolates between waypoints', () => {
    expect(offeredRpsAt(spike, 5)).toBe(550);
    expect(offeredRpsAt(spike, 15)).toBe(550);
  });
});

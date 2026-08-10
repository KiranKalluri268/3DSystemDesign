import { describe, expect, it } from 'vitest';
import { estimateTotalOffered, offeredRpsAt } from './traffic';

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

describe('estimateTotalOffered', () => {
  it('is zero for an empty profile or zero duration', () => {
    expect(estimateTotalOffered([], 30)).toBe(0);
    expect(estimateTotalOffered(spike, 0)).toBe(0);
  });

  it('matches rps * duration for a flat profile', () => {
    const flat = [
      { atSecond: 0, rps: 100 },
      { atSecond: 10, rps: 100 },
    ];
    expect(estimateTotalOffered(flat, 10)).toBeCloseTo(1000);
  });

  it('integrates a ramp as a trapezoid', () => {
    const ramp = [
      { atSecond: 0, rps: 0 },
      { atSecond: 10, rps: 100 },
    ];
    // Triangle: base 10, height 100, area 500.
    expect(estimateTotalOffered(ramp, 10)).toBeCloseTo(500);
  });

  it('stops at the requested duration, not the end of the profile', () => {
    const ramp = [
      { atSecond: 0, rps: 0 },
      { atSecond: 20, rps: 200 },
    ];
    // Half the ramp: triangle with base 10, height 100, area 500.
    expect(estimateTotalOffered(ramp, 10)).toBeCloseTo(500);
  });

  it('holds the last value flat past the final waypoint', () => {
    const profile = [
      { atSecond: 0, rps: 100 },
      { atSecond: 10, rps: 100 },
    ];
    expect(estimateTotalOffered(profile, 15)).toBeCloseTo(100 * 15);
  });

  it('agrees with a fine-grained numerical integration', () => {
    // A cross-check against the definition, independent of the closed form.
    let numeric = 0;
    const dt = 0.001;
    for (let t = 0; t < 20; t += dt) {
      numeric += offeredRpsAt(spike, t) * dt;
    }
    expect(estimateTotalOffered(spike, 20)).toBeCloseTo(numeric, 0);
  });
});

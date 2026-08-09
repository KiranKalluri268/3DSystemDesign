import type { Level } from './types';

/**
 * Offered load at a given moment, linearly interpolated between the level's
 * waypoints. Before the first waypoint and after the last, load is held flat
 * so a profile never has to spell out its own edges.
 */
export function offeredRpsAt(
  profile: Level['trafficProfile'],
  second: number,
): number {
  if (profile.length === 0) return 0;

  const first = profile[0]!;
  if (second <= first.atSecond) return first.rps;

  for (let i = 1; i < profile.length; i++) {
    const prev = profile[i - 1]!;
    const next = profile[i]!;
    if (second <= next.atSecond) {
      const span = next.atSecond - prev.atSecond;
      if (span <= 0) return next.rps;
      const t = (second - prev.atSecond) / span;
      return prev.rps + (next.rps - prev.rps) * t;
    }
  }

  return profile[profile.length - 1]!.rps;
}

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

/**
 * Expected total requests offered over a run, integrating the profile
 * exactly rather than sampling it — each segment between waypoints is
 * linear, so its contribution is just the trapezoid area.
 *
 * Used to size the packet trace: the engine only animates a bounded sample
 * of requests (rendering every packet at high RPS would be pointless and
 * slow), and picking the sampling interval needs to know the size of the
 * population being sampled from before the run happens.
 */
export function estimateTotalOffered(
  profile: Level['trafficProfile'],
  durationSeconds: number,
): number {
  if (profile.length === 0 || durationSeconds <= 0) return 0;

  let total = 0;
  for (let i = 1; i < profile.length; i++) {
    const prev = profile[i - 1]!;
    const next = profile[i]!;
    const segmentEnd = Math.min(next.atSecond, durationSeconds);
    const span = segmentEnd - prev.atSecond;
    if (span <= 0) continue;
    const nextRps = next.atSecond > prev.atSecond
      ? prev.rps + ((next.rps - prev.rps) * (segmentEnd - prev.atSecond)) / (next.atSecond - prev.atSecond)
      : next.rps;
    total += ((prev.rps + nextRps) / 2) * span;
    if (segmentEnd >= durationSeconds) return total;
  }

  // Duration extends past the last waypoint: the profile holds flat.
  const last = profile[profile.length - 1]!;
  if (durationSeconds > last.atSecond) {
    total += last.rps * (durationSeconds - last.atSecond);
  }
  return total;
}

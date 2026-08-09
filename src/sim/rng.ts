/**
 * Seeded pseudo-random source.
 *
 * The simulation must be reproducible: the same topology and the same seed
 * have to produce the same metrics every run, or a player cannot tell whether
 * their change helped or the dice moved. `Math.random` is therefore banned
 * everywhere in `src/sim`.
 *
 * mulberry32 — small, fast, and good enough for jitter and coin flips. It is
 * not cryptographic and must never be used as if it were.
 */
export interface Rng {
  /** Uniform in [0, 1). */
  next(): number;
}

export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  return {
    next() {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

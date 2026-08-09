/** Playfield is GRID_SIZE x GRID_SIZE world units, one unit per placeable cell. */
export const GRID_SIZE = 20;

/** Simulation resolution. The engine advances in fixed ticks, never in frames. */
export const TICK_MS = 10;

/**
 * How much backlog a component will hold before shedding load.
 *
 * Real systems bound their queues, and the bound is what turns a slow service
 * into a failing one — which is the lesson. Unbounded queues would instead
 * show infinite latency and a 0% error rate, teaching the opposite.
 */
export const MAX_QUEUE_SECONDS = 2;

/** A request that has been alive this long is given up on and counted as an error. */
export const REQUEST_TIMEOUT_MS = 5_000;

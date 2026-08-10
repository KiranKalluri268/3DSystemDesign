import { create } from 'zustand';
import { runSimulation, type RunResult } from '../sim/engine';
import { scoreRun, type Verdict } from '../sim/score';
import { TICK_MS } from '../sim/constants';
import { SANDBOX_LEVEL } from '../levels/sandbox';
import type { Topology } from '../sim/types';

export type RunStatus = 'editing' | 'running' | 'finished';

/** Same seed every run, so replaying an unchanged topology gives the same
 * verdict — a player tuning a design needs to trust that what changed the
 * outcome was their edit, not the dice. */
const RUN_SEED = 1;

const TICKS_PER_SECOND = 1000 / TICK_MS;

export interface RunState {
  status: RunStatus;
  result: RunResult | null;
  verdict: Verdict | null;
  /** The topology the current result was computed from, frozen for playback and the HUD. */
  topology: Topology | null;
  /** Current playback position, in simulated ticks. Fractional, for smooth interpolation. */
  playbackTick: number;
  /** Simulated seconds advanced per real second of playback. */
  speed: number;

  start: (topology: Topology) => void;
  advance: (deltaSeconds: number) => void;
  setSpeed: (speed: number) => void;
  reset: () => void;
}

export const useRun = create<RunState>((set, get) => ({
  status: 'editing',
  result: null,
  verdict: null,
  topology: null,
  playbackTick: 0,
  speed: 4,

  start: (topology) => {
    const result = runSimulation(topology, SANDBOX_LEVEL, { seed: RUN_SEED });
    const verdict = scoreRun(result, SANDBOX_LEVEL, topology);
    // A refused topology has nothing to animate — go straight to the
    // explanation instead of "playing" zero ticks of nothing.
    const status: RunStatus = result.issues.length > 0 ? 'finished' : 'running';
    set({ status, result, verdict, topology, playbackTick: 0 });
  },

  advance: (deltaSeconds) => {
    const { status, result, speed, playbackTick } = get();
    if (status !== 'running' || !result) return;
    const next = playbackTick + deltaSeconds * speed * TICKS_PER_SECOND;
    if (next >= result.lastTick) {
      set({ playbackTick: result.lastTick, status: 'finished' });
    } else {
      set({ playbackTick: next });
    }
  },

  setSpeed: (speed) => set({ speed }),

  reset: () =>
    set({ status: 'editing', result: null, verdict: null, topology: null, playbackTick: 0 }),
}));

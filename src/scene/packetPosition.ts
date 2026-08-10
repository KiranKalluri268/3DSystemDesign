import { attachPoint } from './board-geometry';
import type { PacketTrace } from '../sim/engine';
import type { Cell } from '../sim/types';

export type PacketVisualState = 'waiting' | 'traveling' | 'completed' | 'dropped';

export interface PacketPosition {
  visible: boolean;
  position: [number, number, number];
  state: PacketVisualState;
}

/** How long a finished packet lingers before disappearing, so a drop reads as an event, not a jump cut. */
const FADE_TICKS = 15;

const INVISIBLE: PacketPosition = { visible: false, position: [0, 0, 0], state: 'waiting' };

/**
 * Where a traced packet is at a given tick, for animation.
 *
 * Pure arithmetic on the trace's segments — no Three.js, no React — so the
 * geometry can be tested without a renderer. `cellOf` looks up where a node
 * currently sits on the board; `clientCell` is where a completed packet
 * animates back to, since a response visually returns to the requester.
 */
export function packetPositionAt(
  trace: PacketTrace,
  tick: number,
  cellOf: (nodeId: string) => Cell | undefined,
  clientCell: Cell,
): PacketPosition {
  const segments = trace.segments;
  if (segments.length === 0) return INVISIBLE;

  const first = segments[0]!;
  if (tick < first.arriveTick) return INVISIBLE;
  if (tick > trace.endTick + FADE_TICKS) return INVISIBLE;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]!;
    const cell = cellOf(seg.nodeId);
    const here = cell ? attachPoint(cell) : ([0, 0, 0] as [number, number, number]);

    // Still sitting at this node — either genuinely queued, or (once
    // dropped, at endTick) about to vanish where it was rejected.
    if (seg.departTick === null || tick <= seg.departTick) {
      const isLast = i === segments.length - 1;
      const state: PacketVisualState = isLast && trace.outcome === 'dropped' && tick >= trace.endTick
        ? 'dropped'
        : 'waiting';
      return { visible: true, position: here, state };
    }

    const next = segments[i + 1];
    if (next) {
      if (tick < next.arriveTick) {
        const there = cellOf(next.nodeId);
        const target = there ? attachPoint(there) : here;
        const frac = fraction(tick, seg.departTick, next.arriveTick);
        return { visible: true, position: lerp(here, target, frac), state: 'traveling' };
      }
      continue; // Already past this hop; the next iteration finds where it is now.
    }

    // Last segment, already departed: travelling out of the system. A
    // completed response flies back to the client; a drop mid-flight (the
    // request timed out before it could arrive anywhere) has nowhere
    // meaningful to travel to, so it just fades where it left from.
    const target = trace.outcome === 'completed' ? attachPoint(clientCell) : here;
    const frac = fraction(tick, seg.departTick, trace.endTick);
    return {
      visible: tick <= trace.endTick + FADE_TICKS,
      position: lerp(here, target, frac),
      state: trace.outcome === 'completed' ? 'completed' : 'dropped',
    };
  }

  return INVISIBLE;
}

function fraction(tick: number, from: number, to: number): number {
  const span = Math.max(1, to - from);
  return Math.min(1, Math.max(0, (tick - from) / span));
}

function lerp(
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

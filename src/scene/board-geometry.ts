import { GRID_SIZE } from '../sim/constants';
import type { Cell } from '../sim/types';

/**
 * The map between board cells and world space.
 *
 * Cells are integers from 0 to GRID_SIZE - 1; the world is centred on the
 * origin so the camera orbits the middle of the board rather than a corner.
 * One cell is one world unit.
 */

/** Height of a single stacked instance, and the gap between two of them. */
export const UNIT_HEIGHT = 0.55;
export const UNIT_GAP = 0.08;

const HALF = GRID_SIZE / 2;

export function cellToWorld(cell: Cell): [number, number, number] {
  return [cell.x - HALF + 0.5, 0, cell.z - HALF + 0.5];
}

/**
 * World position back to a cell.
 *
 * A raycast against the floor lands anywhere inside a cell, so the result is
 * floored rather than rounded — rounding would snap to the nearest corner and
 * put the component in whichever neighbouring cell the cursor was closest to.
 */
export function worldToCell(x: number, z: number): Cell {
  return { x: Math.floor(x + HALF), z: Math.floor(z + HALF), y: 0 };
}

/** Centre height of the nth instance in a stack, counting from zero. */
export function stackHeight(index: number): number {
  return UNIT_HEIGHT / 2 + index * (UNIT_HEIGHT + UNIT_GAP);
}

/** Total height of a stack, for placing a label above it. */
export function stackTop(replicas: number): number {
  return replicas * UNIT_HEIGHT + (replicas - 1) * UNIT_GAP;
}

/**
 * Where a wire attaches to a node, regardless of how tall its stack is.
 *
 * Fixed at one instance's centre height rather than the top of the stack, so
 * every wire on the board runs at the same height and reads as a flat layer
 * of cabling instead of zig-zagging up and down as replica counts change.
 */
export function attachPoint(cell: Cell): [number, number, number] {
  const [x, , z] = cellToWorld(cell);
  return [x, UNIT_HEIGHT / 2, z];
}

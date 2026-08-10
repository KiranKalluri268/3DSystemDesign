import { describe, expect, it } from 'vitest';
import {
  UNIT_GAP,
  UNIT_HEIGHT,
  attachPoint,
  cellToWorld,
  stackHeight,
  stackTop,
  worldToCell,
} from './board-geometry';
import { GRID_SIZE } from '../sim/constants';

describe('cell and world coordinates', () => {
  it('centres the board on the origin', () => {
    const [x, , z] = cellToWorld({ x: GRID_SIZE / 2, z: GRID_SIZE / 2, y: 0 });
    expect(x).toBe(0.5);
    expect(z).toBe(0.5);
  });

  it('puts a component in the middle of its cell', () => {
    const [x, , z] = cellToWorld({ x: 0, z: 0, y: 0 });
    expect(x).toBe(-GRID_SIZE / 2 + 0.5);
    expect(z).toBe(-GRID_SIZE / 2 + 0.5);
  });

  it('round-trips a cell through world space', () => {
    for (const cell of [
      { x: 0, z: 0, y: 0 },
      { x: 7, z: 3, y: 0 },
      { x: GRID_SIZE - 1, z: GRID_SIZE - 1, y: 0 },
    ]) {
      const [x, , z] = cellToWorld(cell);
      expect(worldToCell(x, z)).toEqual(cell);
    }
  });

  it('keeps every point inside a cell in that cell', () => {
    // A raycast lands anywhere in the cell, not on its centre. Rounding here
    // would snap to the nearest corner and place into a neighbour.
    const [cx, , cz] = cellToWorld({ x: 4, z: 6, y: 0 });
    for (const dx of [-0.49, -0.2, 0, 0.2, 0.49]) {
      for (const dz of [-0.49, -0.2, 0, 0.2, 0.49]) {
        expect(worldToCell(cx + dx, cz + dz)).toEqual({ x: 4, z: 6, y: 0 });
      }
    }
  });

  it('reports cells off the board rather than clamping', () => {
    // withinBoard is what refuses them; silently clamping would drop a
    // component at the edge when the player aimed past it.
    expect(worldToCell(-GRID_SIZE, 0).x).toBeLessThan(0);
    expect(worldToCell(GRID_SIZE, 0).x).toBeGreaterThanOrEqual(GRID_SIZE);
  });
});

describe('stacking', () => {
  it('sits the first instance on the floor', () => {
    expect(stackHeight(0)).toBeCloseTo(UNIT_HEIGHT / 2);
  });

  it('leaves a visible gap between instances', () => {
    expect(stackHeight(1) - stackHeight(0)).toBeCloseTo(UNIT_HEIGHT + UNIT_GAP);
  });

  it('grows monotonically so replicas read as a tower', () => {
    for (let i = 1; i < 8; i++) {
      expect(stackHeight(i)).toBeGreaterThan(stackHeight(i - 1));
    }
  });

  it('measures the top of the stack above its highest instance', () => {
    for (const replicas of [1, 3, 8]) {
      expect(stackTop(replicas)).toBeGreaterThanOrEqual(
        stackHeight(replicas - 1) + UNIT_HEIGHT / 2,
      );
    }
  });
});

describe('attachPoint', () => {
  it('sits at the same height regardless of replica count', () => {
    // A wire must read as a flat cable; it does not know how tall the stack
    // it is attached to will grow, and must not need to.
    const [, y] = attachPoint({ x: 3, z: 3, y: 0 });
    expect(y).toBeCloseTo(UNIT_HEIGHT / 2);
  });

  it('is centred over the node\'s cell', () => {
    const [x, , z] = attachPoint({ x: 5, z: 7, y: 0 });
    const [cx, , cz] = cellToWorld({ x: 5, z: 7, y: 0 });
    expect(x).toBe(cx);
    expect(z).toBe(cz);
  });
});

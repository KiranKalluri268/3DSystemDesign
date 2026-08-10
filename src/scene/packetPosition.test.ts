import { describe, expect, it } from 'vitest';
import { packetPositionAt } from './packetPosition';
import { attachPoint } from './board-geometry';
import type { PacketTrace } from '../sim/engine';
import type { Cell } from '../sim/types';

const cellA: Cell = { x: 1, z: 1, y: 0 };
const cellB: Cell = { x: 5, z: 5, y: 0 };
const cellC: Cell = { x: 9, z: 9, y: 0 };
const clientCell: Cell = { x: 0, z: 0, y: 0 };

const cells: Record<string, Cell> = { a: cellA, b: cellB, c: cellC };
const cellOf = (id: string): Cell | undefined => cells[id];

describe('packetPositionAt', () => {
  it('is invisible before the packet spawns', () => {
    const trace: PacketTrace = {
      id: 0,
      segments: [{ nodeId: 'a', arriveTick: 10, departTick: 20 }],
      outcome: 'completed',
      endTick: 25,
    };
    expect(packetPositionAt(trace, 5, cellOf, clientCell).visible).toBe(false);
  });

  it('sits exactly at a node while queued', () => {
    const trace: PacketTrace = {
      id: 0,
      segments: [{ nodeId: 'a', arriveTick: 10, departTick: 20 }],
      outcome: 'completed',
      endTick: 25,
    };
    const at = packetPositionAt(trace, 15, cellOf, clientCell);
    expect(at.visible).toBe(true);
    expect(at.state).toBe('waiting');
    expect(at.position).toEqual(attachPoint(cellA));
  });

  it('travels linearly between two nodes', () => {
    const trace: PacketTrace = {
      id: 0,
      segments: [
        { nodeId: 'a', arriveTick: 0, departTick: 10 },
        { nodeId: 'b', arriveTick: 20, departTick: 30 },
      ],
      outcome: 'completed',
      endTick: 40,
    };
    const mid = packetPositionAt(trace, 15, cellOf, clientCell); // halfway from 10 to 20
    expect(mid.state).toBe('traveling');
    const a = attachPoint(cellA);
    const b = attachPoint(cellB);
    expect(mid.position[0]).toBeCloseTo((a[0] + b[0]) / 2);
    expect(mid.position[2]).toBeCloseTo((a[2] + b[2]) / 2);
  });

  it('snaps to the destination the instant it arrives', () => {
    const trace: PacketTrace = {
      id: 0,
      segments: [
        { nodeId: 'a', arriveTick: 0, departTick: 10 },
        { nodeId: 'b', arriveTick: 20, departTick: null },
      ],
      outcome: 'dropped',
      dropReason: 'timeout',
      endTick: 5020,
    };
    const at = packetPositionAt(trace, 20, cellOf, clientCell);
    expect(at.position).toEqual(attachPoint(cellB));
  });

  it('walks through several hops to find the right one', () => {
    const trace: PacketTrace = {
      id: 0,
      segments: [
        { nodeId: 'a', arriveTick: 0, departTick: 5 },
        { nodeId: 'b', arriveTick: 10, departTick: 15 },
        { nodeId: 'c', arriveTick: 20, departTick: 25 },
      ],
      outcome: 'completed',
      endTick: 30,
    };
    const at = packetPositionAt(trace, 22, cellOf, clientCell);
    expect(at.state).toBe('waiting');
    expect(at.position).toEqual(attachPoint(cellC));
  });

  it('animates a completed packet back toward the client', () => {
    const trace: PacketTrace = {
      id: 0,
      segments: [{ nodeId: 'a', arriveTick: 0, departTick: 10 }],
      outcome: 'completed',
      endTick: 20,
    };
    const start = packetPositionAt(trace, 10, cellOf, clientCell);
    const end = packetPositionAt(trace, 20, cellOf, clientCell);
    expect(start.position).toEqual(attachPoint(cellA));
    expect(end.position[0]).toBeCloseTo(attachPoint(clientCell)[0]);
    expect(end.position[2]).toBeCloseTo(attachPoint(clientCell)[2]);
  });

  it('fades a dropped packet in place rather than sending it anywhere', () => {
    const trace: PacketTrace = {
      id: 0,
      segments: [{ nodeId: 'a', arriveTick: 0, departTick: 0 }], // bounced instantly
      outcome: 'dropped',
      dropReason: 'queue_full',
      endTick: 0,
    };
    const at = packetPositionAt(trace, 0, cellOf, clientCell);
    expect(at.state).toBe('dropped');
    expect(at.position).toEqual(attachPoint(cellA));
  });

  it('disappears once its fade window has passed', () => {
    const trace: PacketTrace = {
      id: 0,
      segments: [{ nodeId: 'a', arriveTick: 0, departTick: 0 }],
      outcome: 'dropped',
      dropReason: 'queue_full',
      endTick: 0,
    };
    expect(packetPositionAt(trace, 100, cellOf, clientCell).visible).toBe(false);
  });

  it('is invisible for a trace with no segments', () => {
    const trace: PacketTrace = { id: 0, segments: [], outcome: 'dropped', endTick: 0 };
    expect(packetPositionAt(trace, 0, cellOf, clientCell).visible).toBe(false);
  });

  it('falls back rather than throwing when a node has been removed from the board', () => {
    const trace: PacketTrace = {
      id: 0,
      segments: [{ nodeId: 'ghost', arriveTick: 0, departTick: null }],
      outcome: 'dropped',
      dropReason: 'timeout',
      endTick: 10,
    };
    expect(() => packetPositionAt(trace, 5, cellOf, clientCell)).not.toThrow();
  });
});

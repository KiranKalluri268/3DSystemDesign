import { describe, expect, it } from 'vitest';
import {
  MAX_REPLICAS,
  createIdFactory,
  emptyTopology,
  moveNode,
  nodeAt,
  placeNode,
  removeNode,
  setReplicas,
  withinBoard,
} from './topology';
import { GRID_SIZE } from '../sim/constants';
import type { Topology } from '../sim/types';

const cell = (x: number, z: number) => ({ x, z, y: 0 });

function place(topology: Topology, x: number, z: number, kind = 'api_server' as const) {
  return placeNode(topology, kind, cell(x, z), createIdFactory(`${x}-${z}-`));
}

describe('withinBoard', () => {
  it('accepts cells on the board', () => {
    expect(withinBoard(cell(0, 0))).toBe(true);
    expect(withinBoard(cell(GRID_SIZE - 1, GRID_SIZE - 1))).toBe(true);
  });

  it('rejects cells past the edge', () => {
    expect(withinBoard(cell(-1, 0))).toBe(false);
    expect(withinBoard(cell(0, GRID_SIZE))).toBe(false);
  });

  it('rejects fractional cells', () => {
    // A raycast against the floor returns a float; it must be snapped first.
    expect(withinBoard(cell(1.5, 2))).toBe(false);
  });
});

describe('placeNode', () => {
  it('places a component and reports its id', () => {
    const { topology, placedId } = place(emptyTopology(), 3, 4);
    expect(placedId).not.toBeNull();
    expect(topology.nodes).toHaveLength(1);
    expect(nodeAt(topology, cell(3, 4))?.id).toBe(placedId);
  });

  it('starts a component at one instance', () => {
    const { topology } = place(emptyTopology(), 3, 4);
    expect(topology.nodes[0]!.replicas).toBe(1);
  });

  it('refuses a cell that is already taken', () => {
    const first = place(emptyTopology(), 3, 4).topology;
    const second = place(first, 3, 4, 'cache');
    expect(second.placedId).toBeNull();
    expect(second.topology.nodes).toHaveLength(1);
  });

  it('refuses a cell off the board', () => {
    const result = place(emptyTopology(), -1, 4);
    expect(result.placedId).toBeNull();
    expect(result.topology.nodes).toHaveLength(0);
  });

  it('does not mutate the topology it was given', () => {
    const before = emptyTopology();
    place(before, 3, 4);
    expect(before.nodes).toHaveLength(0);
  });
});

describe('moveNode', () => {
  it('moves a node to an empty cell', () => {
    const { topology, placedId } = place(emptyTopology(), 1, 1);
    const moved = moveNode(topology, placedId!, cell(5, 6));
    expect(nodeAt(moved, cell(5, 6))?.id).toBe(placedId);
    expect(nodeAt(moved, cell(1, 1))).toBeUndefined();
  });

  it('refuses to drop a node onto another one', () => {
    const a = place(emptyTopology(), 1, 1);
    const b = place(a.topology, 2, 2, 'cache');
    const moved = moveNode(b.topology, a.placedId!, cell(2, 2));
    expect(moved).toBe(b.topology);
    expect(nodeAt(moved, cell(2, 2))?.kind).toBe('cache');
  });

  it('lets a node be dropped back on the cell it came from', () => {
    // A click without a real drag ends here, and must not read as occupied.
    const { topology, placedId } = place(emptyTopology(), 1, 1);
    const moved = moveNode(topology, placedId!, cell(1, 1));
    expect(nodeAt(moved, cell(1, 1))?.id).toBe(placedId);
  });

  it('refuses a cell off the board', () => {
    const { topology, placedId } = place(emptyTopology(), 1, 1);
    expect(moveNode(topology, placedId!, cell(GRID_SIZE, 1))).toBe(topology);
  });

  it('keeps the node stack on the floor', () => {
    const { topology, placedId } = place(emptyTopology(), 1, 1);
    const moved = moveNode(topology, placedId!, cell(4, 4));
    expect(nodeAt(moved, cell(4, 4))?.cell.y).toBe(0);
  });
});

describe('removeNode', () => {
  it('removes the node', () => {
    const { topology, placedId } = place(emptyTopology(), 1, 1);
    expect(removeNode(topology, placedId!).nodes).toHaveLength(0);
  });

  it('takes every connection touching it', () => {
    const a = place(emptyTopology(), 1, 1);
    const b = place(a.topology, 2, 2, 'sql_primary');
    const wired: Topology = {
      ...b.topology,
      links: [
        { id: 'l1', from: a.placedId!, to: b.placedId! },
        { id: 'l2', from: b.placedId!, to: a.placedId! },
      ],
    };
    // A leftover link would surface later as a validation error naming a
    // component that is no longer on the board.
    expect(removeNode(wired, a.placedId!).links).toHaveLength(0);
  });

  it('leaves unrelated links alone', () => {
    const a = place(emptyTopology(), 1, 1);
    const b = place(a.topology, 2, 2, 'cache');
    const c = place(b.topology, 3, 3, 'sql_primary');
    const wired: Topology = {
      ...c.topology,
      links: [{ id: 'l1', from: b.placedId!, to: c.placedId! }],
    };
    expect(removeNode(wired, a.placedId!).links).toHaveLength(1);
  });

  it('ignores an id that is not there', () => {
    const { topology } = place(emptyTopology(), 1, 1);
    expect(removeNode(topology, 'ghost').nodes).toHaveLength(1);
  });
});

describe('setReplicas', () => {
  it('scales a component up', () => {
    const { topology, placedId } = place(emptyTopology(), 1, 1);
    expect(setReplicas(topology, placedId!, 4).nodes[0]!.replicas).toBe(4);
  });

  it('never goes below one instance', () => {
    // Zero replicas is a validation error, so the editor must not produce it.
    const { topology, placedId } = place(emptyTopology(), 1, 1);
    expect(setReplicas(topology, placedId!, 0).nodes[0]!.replicas).toBe(1);
    expect(setReplicas(topology, placedId!, -3).nodes[0]!.replicas).toBe(1);
  });

  it('caps the stack so it cannot grow off the board', () => {
    const { topology, placedId } = place(emptyTopology(), 1, 1);
    expect(setReplicas(topology, placedId!, 999).nodes[0]!.replicas).toBe(MAX_REPLICAS);
  });

  it('rounds a fractional count', () => {
    const { topology, placedId } = place(emptyTopology(), 1, 1);
    expect(setReplicas(topology, placedId!, 2.6).nodes[0]!.replicas).toBe(3);
  });
});

describe('createIdFactory', () => {
  it('does not repeat an id', () => {
    const next = createIdFactory();
    const ids = new Set([next(), next(), next()]);
    expect(ids.size).toBe(3);
  });
});

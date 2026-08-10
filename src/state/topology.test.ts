import { describe, expect, it } from 'vitest';
import {
  MAX_REPLICAS,
  addLink,
  canLink,
  createIdFactory,
  emptyTopology,
  linksTouching,
  moveNode,
  nodeAt,
  placeNode,
  removeLink,
  removeNode,
  setReplicas,
  withinBoard,
} from './topology';
import { GRID_SIZE } from '../sim/constants';
import type { NodeKind, Topology } from '../sim/types';

const cell = (x: number, z: number) => ({ x, z, y: 0 });

function place(topology: Topology, x: number, z: number, kind: NodeKind = 'api_server') {
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

describe('addLink', () => {
  function pair(fromKind: NodeKind, toKind: NodeKind) {
    const a = place(emptyTopology(), 1, 1, fromKind);
    const b = place(a.topology, 2, 2, toKind);
    return { topology: b.topology, from: a.placedId!, to: b.placedId! };
  }

  it('connects two components the roster allows', () => {
    const { topology, from, to } = pair('load_balancer', 'api_server');
    const result = addLink(topology, from, to, createIdFactory('l'));
    expect(result.refused).toBeUndefined();
    expect(result.linkId).not.toBeNull();
    expect(result.topology.links).toEqual([{ id: result.linkId, from, to }]);
  });

  it('refuses a connection the roster forbids', () => {
    const { topology, from, to } = pair('client', 'sql_primary');
    const result = addLink(topology, from, to, createIdFactory('l'));
    expect(result.refused).toBe('illegal');
    expect(result.topology.links).toHaveLength(0);
  });

  it('refuses a component linking to itself', () => {
    const { topology, from } = pair('api_server', 'cache');
    const result = addLink(topology, from, from, createIdFactory('l'));
    expect(result.refused).toBe('self');
  });

  it('refuses a connection that already exists', () => {
    const { topology, from, to } = pair('load_balancer', 'api_server');
    const first = addLink(topology, from, to, createIdFactory('l'));
    const second = addLink(first.topology, from, to, createIdFactory('l'));
    expect(second.refused).toBe('duplicate');
    expect(second.topology.links).toHaveLength(1);
  });

  it('allows the reverse direction of an existing link', () => {
    // The roster forbids most reverse pairs anyway, but the duplicate check
    // itself must key on direction, not on the unordered pair.
    const { topology, from, to } = pair('load_balancer', 'api_server');
    const forward = addLink(topology, from, to, createIdFactory('l'));
    const reverse = addLink(forward.topology, to, from, createIdFactory('l'));
    expect(reverse.refused).toBe('illegal'); // api_server -> load_balancer isn't in the roster
  });

  it('refuses a link touching a node that is not there', () => {
    const { topology, from } = pair('load_balancer', 'api_server');
    const result = addLink(topology, from, 'ghost', createIdFactory('l'));
    expect(result.refused).toBe('missing_node');
  });

  it('does not mutate the topology it was given', () => {
    const { topology, from, to } = pair('load_balancer', 'api_server');
    addLink(topology, from, to, createIdFactory('l'));
    expect(topology.links).toHaveLength(0);
  });
});

describe('removeLink', () => {
  it('removes only the named link', () => {
    const { topology, from, to } = (() => {
      const a = place(emptyTopology(), 1, 1, 'load_balancer');
      const b = place(a.topology, 2, 2, 'api_server');
      const c = place(b.topology, 3, 3, 'api_server');
      const l1 = addLink(c.topology, a.placedId!, b.placedId!, createIdFactory('l1-'));
      const l2 = addLink(l1.topology, a.placedId!, c.placedId!, createIdFactory('l2-'));
      return { topology: l2.topology, from: l1.linkId!, to: l2.linkId! };
    })();
    const after = removeLink(topology, from);
    expect(after.links.map((l) => l.id)).toEqual([to]);
  });

  it('ignores an id that is not there', () => {
    const topology = emptyTopology();
    expect(removeLink(topology, 'ghost')).toEqual(topology);
  });
});

describe('canLink', () => {
  it('agrees with the roster', () => {
    expect(canLink('load_balancer', 'api_server')).toBe(true);
    expect(canLink('client', 'sql_primary')).toBe(false);
  });

  it('never allows a kind to link to itself', () => {
    expect(canLink('api_server', 'api_server')).toBe(false);
  });
});

describe('linksTouching', () => {
  it('finds links in either direction', () => {
    const a = place(emptyTopology(), 1, 1, 'load_balancer');
    const b = place(a.topology, 2, 2, 'api_server');
    const c = place(b.topology, 3, 3, 'sql_primary');
    const l1 = addLink(c.topology, a.placedId!, b.placedId!, createIdFactory('l1-'));
    const l2 = addLink(l1.topology, b.placedId!, c.placedId!, createIdFactory('l2-'));
    const touching = linksTouching(l2.topology, b.placedId!);
    expect(touching).toHaveLength(2);
  });

  it('returns nothing for a node with no connections', () => {
    const { topology, placedId } = place(emptyTopology(), 1, 1);
    expect(linksTouching(topology, placedId!)).toEqual([]);
  });
});

describe('createIdFactory', () => {
  it('does not repeat an id', () => {
    const next = createIdFactory();
    const ids = new Set([next(), next(), next()]);
    expect(ids.size).toBe(3);
  });
});

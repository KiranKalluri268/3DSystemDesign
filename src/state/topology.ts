import { GRID_SIZE } from '../sim/constants';
import { specFor } from '../sim/specs';
import type { Cell, Link, NodeKind, PlacedNode, Topology } from '../sim/types';

/**
 * Editing operations on a topology.
 *
 * Kept as pure functions rather than methods on the store so the rules —
 * what may be placed where, what a delete takes with it — can be tested
 * without React and without a renderer. The store wires them to the UI; it
 * does not decide anything itself.
 */

/** Tallest stack a component may be scaled to, so a tower cannot leave the board. */
export const MAX_REPLICAS = 8;

export const emptyTopology = (): Topology => ({ nodes: [], links: [] });

export function withinBoard(cell: Cell): boolean {
  return (
    Number.isInteger(cell.x) &&
    Number.isInteger(cell.z) &&
    cell.x >= 0 &&
    cell.z >= 0 &&
    cell.x < GRID_SIZE &&
    cell.z < GRID_SIZE
  );
}

export function nodeAt(topology: Topology, cell: Cell): PlacedNode | undefined {
  return topology.nodes.find((n) => n.cell.x === cell.x && n.cell.z === cell.z);
}

export interface PlaceResult {
  topology: Topology;
  /** The new node's id, or null if the placement was refused. */
  placedId: string | null;
}

export function placeNode(
  topology: Topology,
  kind: NodeKind,
  cell: Cell,
  nextId: () => string,
): PlaceResult {
  if (!withinBoard(cell) || nodeAt(topology, cell)) {
    return { topology, placedId: null };
  }
  const id = nextId();
  return {
    topology: {
      ...topology,
      nodes: [...topology.nodes, { id, kind, cell: { ...cell, y: 0 }, replicas: 1 }],
    },
    placedId: id,
  };
}

/**
 * Move a node to a new cell. Refused if the cell is off the board or taken —
 * a silent no-op, because the drag simply snaps back and the player sees why.
 */
export function moveNode(topology: Topology, id: string, cell: Cell): Topology {
  const existing = nodeAt(topology, cell);
  if (!withinBoard(cell) || (existing && existing.id !== id)) return topology;
  return {
    ...topology,
    nodes: topology.nodes.map((n) =>
      n.id === id ? { ...n, cell: { ...cell, y: 0 } } : n,
    ),
  };
}

/**
 * Remove a node and every connection touching it. Leaving links behind would
 * produce dangling references that only surface later as a validation error
 * pointing at a component that is no longer on the board.
 */
export function removeNode(topology: Topology, id: string): Topology {
  return {
    nodes: topology.nodes.filter((n) => n.id !== id),
    links: topology.links.filter((l) => l.from !== id && l.to !== id),
  };
}

export type LinkRefusalReason = 'self' | 'duplicate' | 'illegal' | 'missing_node';

export interface LinkResult {
  topology: Topology;
  linkId: string | null;
  /** Why the link was refused, so the UI can say something specific. */
  refused?: LinkRefusalReason;
}

/**
 * Connect two placed components.
 *
 * Refusals mirror the rules `validateTopology` would otherwise catch after
 * the fact — a self-link, a repeat of an existing connection, or a target
 * kind the roster forbids. Checking here means the player never gets to draw
 * a wire that a run would immediately reject; the message comes at the
 * moment of the click instead of after hitting Run.
 */
export function addLink(
  topology: Topology,
  fromId: string,
  toId: string,
  nextId: () => string,
): LinkResult {
  const from = topology.nodes.find((n) => n.id === fromId);
  const to = topology.nodes.find((n) => n.id === toId);
  if (!from || !to) return { topology, linkId: null, refused: 'missing_node' };
  if (fromId === toId) return { topology, linkId: null, refused: 'self' };
  if (topology.links.some((l) => l.from === fromId && l.to === toId)) {
    return { topology, linkId: null, refused: 'duplicate' };
  }
  if (!specFor(from.kind).canConnectTo.includes(to.kind)) {
    return { topology, linkId: null, refused: 'illegal' };
  }

  const id = nextId();
  return {
    topology: { ...topology, links: [...topology.links, { id, from: fromId, to: toId }] },
    linkId: id,
  };
}

export function removeLink(topology: Topology, id: string): Topology {
  return { ...topology, links: topology.links.filter((l) => l.id !== id) };
}

/** Whether the roster would ever allow a link from this kind to that one. */
export function canLink(fromKind: NodeKind, toKind: NodeKind): boolean {
  return fromKind !== toKind && specFor(fromKind).canConnectTo.includes(toKind);
}

export function linksTouching(topology: Topology, nodeId: string): Link[] {
  return topology.links.filter((l) => l.from === nodeId || l.to === nodeId);
}

export function setReplicas(topology: Topology, id: string, replicas: number): Topology {
  const clamped = Math.max(1, Math.min(MAX_REPLICAS, Math.round(replicas)));
  return {
    ...topology,
    nodes: topology.nodes.map((n) => (n.id === id ? { ...n, replicas: clamped } : n)),
  };
}

/** Sequential ids, so a saved board reads sensibly and tests are predictable. */
export function createIdFactory(prefix = 'n'): () => string {
  let n = 0;
  return () => `${prefix}${++n}`;
}

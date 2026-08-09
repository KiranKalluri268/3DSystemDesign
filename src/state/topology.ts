import { GRID_SIZE } from '../sim/constants';
import type { Cell, NodeKind, PlacedNode, Topology } from '../sim/types';

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

import { create } from 'zustand';
import {
  createIdFactory,
  emptyTopology,
  moveNode,
  placeNode,
  removeNode,
  setReplicas,
} from './topology';
import type { Cell, NodeKind, Topology } from '../sim/types';

const nextId = createIdFactory();

export interface BoardState {
  topology: Topology;
  /** The palette entry armed for placing, or null when the palette is idle. */
  armedKind: NodeKind | null;
  /** The component the inspector is showing, or null. */
  selectedId: string | null;
  /** The node currently being dragged, so the scene can render it differently. */
  draggingId: string | null;

  armKind: (kind: NodeKind | null) => void;
  select: (id: string | null) => void;
  placeAt: (cell: Cell) => void;
  beginDrag: (id: string) => void;
  dragTo: (cell: Cell) => void;
  endDrag: () => void;
  deleteSelected: () => void;
  scaleSelected: (delta: number) => void;
  reset: () => void;
}

export const useBoard = create<BoardState>((set, get) => ({
  topology: emptyTopology(),
  armedKind: null,
  selectedId: null,
  draggingId: null,

  armKind: (kind) => set({ armedKind: kind, selectedId: null }),

  select: (id) => set({ selectedId: id, armedKind: null }),

  placeAt: (cell) => {
    const { armedKind, topology } = get();
    if (!armedKind) return;
    const { topology: next, placedId } = placeNode(topology, armedKind, cell, nextId);
    if (!placedId) return;
    // Stay armed after placing: building a tier means dropping several of the
    // same component, and re-picking it from the palette every time is friction.
    set({ topology: next, selectedId: placedId });
  },

  beginDrag: (id) => set({ draggingId: id, selectedId: id, armedKind: null }),

  dragTo: (cell) => {
    const { draggingId, topology } = get();
    if (!draggingId) return;
    set({ topology: moveNode(topology, draggingId, cell) });
  },

  endDrag: () => set({ draggingId: null }),

  deleteSelected: () => {
    const { selectedId, topology } = get();
    if (!selectedId) return;
    set({ topology: removeNode(topology, selectedId), selectedId: null });
  },

  scaleSelected: (delta) => {
    const { selectedId, topology } = get();
    if (!selectedId) return;
    const node = topology.nodes.find((n) => n.id === selectedId);
    if (!node) return;
    set({ topology: setReplicas(topology, selectedId, node.replicas + delta) });
  },

  reset: () =>
    set({
      topology: emptyTopology(),
      armedKind: null,
      selectedId: null,
      draggingId: null,
    }),
}));

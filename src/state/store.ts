import { create } from 'zustand';
import {
  addLink,
  createIdFactory,
  emptyTopology,
  moveNode,
  placeNode,
  removeLink,
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
  /** The connection the inspector is showing, or null. Mutually exclusive with selectedId. */
  selectedLinkId: string | null;
  /** The node currently being dragged, so the scene can render it differently. */
  draggingId: string | null;
  /** Whether a click on a component starts or completes a connection. */
  linking: boolean;
  /** The source node picked for the connection being drawn, or null. */
  linkFrom: string | null;

  armKind: (kind: NodeKind | null) => void;
  select: (id: string | null) => void;
  placeAt: (cell: Cell) => void;
  beginDrag: (id: string) => void;
  dragTo: (cell: Cell) => void;
  endDrag: () => void;
  deleteSelected: () => void;
  scaleSelected: (delta: number) => void;
  setLinking: (on: boolean) => void;
  clickNodeForLink: (id: string) => void;
  selectLink: (id: string | null) => void;
  deleteSelectedLink: () => void;
  reset: () => void;
}

export const useBoard = create<BoardState>((set, get) => ({
  topology: emptyTopology(),
  armedKind: null,
  selectedId: null,
  selectedLinkId: null,
  draggingId: null,
  linking: false,
  linkFrom: null,

  armKind: (kind) =>
    set({ armedKind: kind, selectedId: null, selectedLinkId: null, linking: false, linkFrom: null }),

  select: (id) => set({ selectedId: id, selectedLinkId: null, armedKind: null }),

  placeAt: (cell) => {
    const { armedKind, topology } = get();
    if (!armedKind) return;
    const { topology: next, placedId } = placeNode(topology, armedKind, cell, nextId);
    if (!placedId) return;
    // Stay armed after placing: building a tier means dropping several of the
    // same component, and re-picking it from the palette every time is friction.
    set({ topology: next, selectedId: placedId, selectedLinkId: null });
  },

  beginDrag: (id) => {
    if (get().linking) return;
    set({ draggingId: id, selectedId: id, selectedLinkId: null, armedKind: null });
  },

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

  setLinking: (on) =>
    set({
      linking: on,
      linkFrom: null,
      armedKind: on ? null : get().armedKind,
      selectedId: null,
      selectedLinkId: null,
    }),

  /**
   * A click on a component while in linking mode: the first click picks the
   * source, the second draws the connection. Clicking the source again
   * cancels the pick rather than trying to link it to itself.
   *
   * The source stays picked after a successful link, the same way the
   * palette stays armed after a placement — a load balancer fanning out to
   * six API servers is six clicks on the targets, not six re-picks of the LB.
   */
  clickNodeForLink: (id) => {
    const { linkFrom, topology } = get();
    if (!linkFrom) {
      set({ linkFrom: id });
      return;
    }
    if (linkFrom === id) {
      set({ linkFrom: null });
      return;
    }
    const result = addLink(topology, linkFrom, id, nextId);
    if (result.linkId) set({ topology: result.topology });
    // A refused link (self/duplicate/illegal) leaves linkFrom as it was, so
    // the player can immediately try a different target without re-picking.
  },

  selectLink: (id) => set({ selectedLinkId: id, selectedId: null, armedKind: null }),

  deleteSelectedLink: () => {
    const { selectedLinkId, topology } = get();
    if (!selectedLinkId) return;
    set({ topology: removeLink(topology, selectedLinkId), selectedLinkId: null });
  },

  reset: () =>
    set({
      topology: emptyTopology(),
      armedKind: null,
      selectedId: null,
      selectedLinkId: null,
      draggingId: null,
      linking: false,
      linkFrom: null,
    }),
}));

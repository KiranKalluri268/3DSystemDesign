import { beforeEach, describe, expect, it } from 'vitest';
import { useBoard } from './store';
import { MAX_REPLICAS } from './topology';
import type { NodeKind } from '../sim/types';

const cell = (x: number, z: number) => ({ x, z, y: 0 });
const state = () => useBoard.getState();

/** Arm a kind and drop it, returning the new node's id. */
function drop(x: number, z: number, kind: NodeKind = 'api_server'): string {
  state().armKind(kind);
  state().placeAt(cell(x, z));
  return state().selectedId!;
}

describe('board store', () => {
  beforeEach(() => state().reset());

  it('places nothing until a component is armed', () => {
    state().placeAt(cell(2, 2));
    expect(state().topology.nodes).toHaveLength(0);
  });

  it('places the armed component and selects it', () => {
    const id = drop(2, 2);
    expect(state().topology.nodes).toHaveLength(1);
    expect(state().selectedId).toBe(id);
  });

  it('stays armed so a tier can be built without re-picking', () => {
    state().armKind('api_server');
    state().placeAt(cell(1, 1));
    state().placeAt(cell(2, 1));
    state().placeAt(cell(3, 1));
    expect(state().topology.nodes).toHaveLength(3);
  });

  it('ignores a drop onto an occupied cell without disarming', () => {
    drop(2, 2);
    state().armKind('cache');
    state().placeAt(cell(2, 2));
    expect(state().topology.nodes).toHaveLength(1);
    expect(state().armedKind).toBe('cache');
  });

  it('disarms the palette when a placed component is selected', () => {
    // Otherwise the next click on the floor places a component the player
    // thought they had stopped placing.
    const id = drop(2, 2);
    state().armKind('cache');
    state().select(id);
    expect(state().armedKind).toBeNull();
  });

  it('drags a node to a new cell', () => {
    const id = drop(2, 2);
    state().beginDrag(id);
    state().dragTo(cell(5, 5));
    state().endDrag();
    const node = state().topology.nodes[0]!;
    expect(node.cell).toMatchObject({ x: 5, z: 5 });
    expect(state().draggingId).toBeNull();
  });

  it('ignores drag movement when nothing is being dragged', () => {
    drop(2, 2);
    state().dragTo(cell(7, 7));
    expect(state().topology.nodes[0]!.cell).toMatchObject({ x: 2, z: 2 });
  });

  it('leaves a node where it was when dragged onto an occupied cell', () => {
    const a = drop(2, 2);
    drop(4, 4, 'cache');
    state().beginDrag(a);
    state().dragTo(cell(4, 4));
    state().endDrag();
    const moved = state().topology.nodes.find((n) => n.id === a)!;
    expect(moved.cell).toMatchObject({ x: 2, z: 2 });
  });

  it('deletes the selected component', () => {
    drop(2, 2);
    state().deleteSelected();
    expect(state().topology.nodes).toHaveLength(0);
    expect(state().selectedId).toBeNull();
  });

  it('does nothing on delete with an empty selection', () => {
    drop(2, 2);
    state().select(null);
    state().deleteSelected();
    expect(state().topology.nodes).toHaveLength(1);
  });

  it('scales the selected component up and down', () => {
    drop(2, 2);
    state().scaleSelected(3);
    expect(state().topology.nodes[0]!.replicas).toBe(4);
    state().scaleSelected(-2);
    expect(state().topology.nodes[0]!.replicas).toBe(2);
  });

  it('holds scaling at the limits rather than refusing', () => {
    drop(2, 2);
    state().scaleSelected(-5);
    expect(state().topology.nodes[0]!.replicas).toBe(1);
    state().scaleSelected(99);
    expect(state().topology.nodes[0]!.replicas).toBe(MAX_REPLICAS);
  });

  it('gives every placed component a distinct id', () => {
    state().armKind('api_server');
    state().placeAt(cell(1, 1));
    state().placeAt(cell(2, 1));
    const ids = new Set(state().topology.nodes.map((n) => n.id));
    expect(ids.size).toBe(2);
  });
});

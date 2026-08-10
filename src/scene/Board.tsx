import { useCallback, useMemo, useState } from 'react';
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber';
import { Grid, OrbitControls } from '@react-three/drei';
import { ComponentStack } from './ComponentStack';
import { LinkLine } from './LinkLine';
import { PacketLayer } from './PacketLayer';
import {
  COMPONENT_COLORS,
  INVALID_COLOR,
  LINK_PREVIEW_VALID_COLOR,
} from './component-colors';
import { UNIT_HEIGHT, attachPoint, cellToWorld, worldToCell } from './board-geometry';
import { GRID_SIZE, TICK_MS } from '../sim/constants';
import { useBoard } from '../state/store';
import { useRun } from '../state/runStore';
import { canLink, nodeAt, withinBoard } from '../state/topology';
import type { Cell, NodeKind } from '../sim/types';

/** Classic isometric pitch, ~35.264°. */
const ISO_PITCH = Math.atan(Math.SQRT1_2);

export function Board() {
  return (
    <Canvas
      orthographic
      camera={{ position: [16, 16, 16], zoom: 38, near: -200, far: 400 }}
      shadows
    >
      <color attach="background" args={['#0e1116']} />
      <ambientLight intensity={0.75} />
      <directionalLight position={[10, 18, 8]} intensity={1.15} castShadow />
      <PlaybackDriver />
      <Scene />
    </Canvas>
  );
}

/**
 * Advances run playback once a frame. Lives inside the Canvas because
 * useFrame needs an r3f render loop — the run store itself stays plain
 * zustand with no rendering concerns, this is the only thing that ticks it.
 */
function PlaybackDriver() {
  useFrame((_, delta) => {
    const { status, advance } = useRun.getState();
    if (status === 'running') advance(delta);
  });
  return null;
}

function Scene() {
  const topology = useBoard((s) => s.topology);
  const armedKind = useBoard((s) => s.armedKind);
  const selectedId = useBoard((s) => s.selectedId);
  const selectedLinkId = useBoard((s) => s.selectedLinkId);
  const draggingId = useBoard((s) => s.draggingId);
  const linking = useBoard((s) => s.linking);
  const linkFrom = useBoard((s) => s.linkFrom);
  const placeAt = useBoard((s) => s.placeAt);
  const select = useBoard((s) => s.select);
  const selectLink = useBoard((s) => s.selectLink);
  const beginDrag = useBoard((s) => s.beginDrag);
  const dragTo = useBoard((s) => s.dragTo);
  const endDrag = useBoard((s) => s.endDrag);
  const clickNodeForLink = useBoard((s) => s.clickNodeForLink);
  const cancelLinkPick = useBoard((s) => s.cancelLinkPick);

  const runStatus = useRun((s) => s.status);
  const runResult = useRun((s) => s.result);
  const playbackTick = useRun((s) => s.playbackTick);
  const editing = runStatus === 'editing';

  const [hovered, setHovered] = useState<Cell | null>(null);

  const onFloorMove = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      const cell = worldToCell(event.point.x, event.point.z);
      setHovered(cell);
      if (draggingId) dragTo(cell);
    },
    [draggingId, dragTo],
  );

  const onFloorDown = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (!editing) return;
      const cell = worldToCell(event.point.x, event.point.z);
      if (linking) {
        // The floor has no node to link to; treat it as backing out of the
        // current pick rather than doing nothing at all.
        cancelLinkPick();
        return;
      }
      if (armedKind) {
        placeAt(cell);
      } else {
        select(null);
        selectLink(null);
      }
    },
    [editing, armedKind, linking, placeAt, select, selectLink, cancelLinkPick],
  );

  const ghostCell = editing && armedKind && hovered && withinBoard(hovered) ? hovered : null;
  const ghostBlocked = ghostCell ? Boolean(nodeAt(topology, ghostCell)) : false;

  const linkSourceNode = linkFrom ? topology.nodes.find((n) => n.id === linkFrom) : undefined;
  const hoveredNode = hovered ? nodeAt(topology, hovered) : undefined;
  const previewTarget =
    editing && linking && linkSourceNode && hoveredNode && hoveredNode.id !== linkFrom
      ? hoveredNode
      : undefined;

  // Queue depth as a fraction of capacity, per node, at the current playback
  // second — the number the danger tint on each box actually reads.
  const dangerByNode = useMemo(() => {
    const fractions = new Map<string, number>();
    if (!runResult) return fractions;
    const ticksPerSecond = 1000 / TICK_MS;
    const second = Math.min(
      Math.floor(playbackTick / ticksPerSecond),
      Math.max(0, ...Object.values(runResult.queueDepthHistory).map((h) => h.length - 1)),
    );
    for (const stats of runResult.nodeStats) {
      const history = runResult.queueDepthHistory[stats.nodeId];
      const depth = history?.[second] ?? 0;
      fractions.set(stats.nodeId, stats.maxQueue > 0 ? depth / stats.maxQueue : 0);
    }
    return fractions;
  }, [runResult, playbackTick]);

  return (
    <>
      {/* The floor is the pick surface: every placement and drag resolves
          against this plane, so it must cover the whole grid exactly. */}
      <mesh
        // Sits just below y=0 so it does not z-fight with the grid drawn on
        // top of it, which makes the grid lines flicker in and out patchily.
        position={[0, -0.01, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerMove={onFloorMove}
        onPointerDown={onFloorDown}
        onPointerUp={endDrag}
        onPointerLeave={() => setHovered(null)}
        receiveShadow
      >
        <planeGeometry args={[GRID_SIZE, GRID_SIZE]} />
        <meshStandardMaterial color="#151b24" />
      </mesh>

      <Grid
        args={[GRID_SIZE, GRID_SIZE]}
        cellSize={1}
        cellColor="#33404f"
        sectionSize={5}
        sectionColor="#3d4c5e"
        fadeDistance={60}
        infiniteGrid={false}
      />

      {ghostCell && armedKind && (
        <Ghost cell={ghostCell} blocked={ghostBlocked} kind={armedKind} />
      )}

      {topology.links.map((link) => {
        const from = topology.nodes.find((n) => n.id === link.from);
        const to = topology.nodes.find((n) => n.id === link.to);
        if (!from || !to) return null; // A dangling link is a validation error, not a render crash.
        return (
          <LinkLine
            key={link.id}
            from={attachPoint(from.cell)}
            to={attachPoint(to.cell)}
            selected={link.id === selectedLinkId}
            onPointerDown={() => {
              if (editing && !linking) selectLink(link.id);
            }}
          />
        );
      })}

      {/* The wire actively being drawn, following the cursor to whatever
          cell is hovered. Its colour previews whether the roster would
          accept the connection before the player commits to the click. */}
      {editing && linking && linkSourceNode && hovered && (
        <LinkLine
          from={attachPoint(linkSourceNode.cell)}
          to={attachPoint(hovered)}
          preview
          color={
            previewTarget && canLink(linkSourceNode.kind, previewTarget.kind)
              ? LINK_PREVIEW_VALID_COLOR
              : INVALID_COLOR
          }
        />
      )}

      {topology.nodes.map((node) => (
        <ComponentStack
          key={node.id}
          node={node}
          selected={editing && node.id === selectedId}
          dragging={node.id === draggingId}
          linkSource={editing && node.id === linkFrom}
          dangerFraction={dangerByNode.get(node.id) ?? 0}
          onPointerDown={(event) => {
            // Without this the floor beneath also handles the click, which
            // would place a component on top of the one being grabbed.
            event.stopPropagation();
            if (!editing) return;
            if (linking) clickNodeForLink(node.id);
            else beginDrag(node.id);
          }}
        />
      ))}

      <PacketLayer />

      <OrbitControls
        makeDefault
        // Dragging a component and orbiting the camera are both pointer
        // drags; letting them run together spins the board while placing.
        enabled={draggingId === null}
        enablePan
        minZoom={18}
        maxZoom={120}
        // Pitch is pinned: free pitch makes it impossible to tell which cell
        // the cursor is over, which is the whole interaction.
        minPolarAngle={Math.PI / 2 - ISO_PITCH}
        maxPolarAngle={Math.PI / 2 - ISO_PITCH}
      />
    </>
  );
}

function Ghost({
  cell,
  blocked,
  kind,
}: {
  cell: Cell;
  blocked: boolean;
  kind: NodeKind;
}) {
  const [x, , z] = cellToWorld(cell);
  return (
    <mesh position={[x, UNIT_HEIGHT / 2, z]}>
      <boxGeometry args={[0.72, UNIT_HEIGHT, 0.72]} />
      <meshStandardMaterial
        color={blocked ? INVALID_COLOR : COMPONENT_COLORS[kind]}
        transparent
        opacity={0.4}
        wireframe={blocked}
      />
    </mesh>
  );
}

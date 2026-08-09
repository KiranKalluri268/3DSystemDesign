import { useCallback, useState } from 'react';
import { Canvas, type ThreeEvent } from '@react-three/fiber';
import { Grid, OrbitControls } from '@react-three/drei';
import { ComponentStack } from './ComponentStack';
import { COMPONENT_COLORS, INVALID_COLOR } from './component-colors';
import { UNIT_HEIGHT, cellToWorld, worldToCell } from './board-geometry';
import { GRID_SIZE } from '../sim/constants';
import { useBoard } from '../state/store';
import { nodeAt, withinBoard } from '../state/topology';
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
      <Scene />
    </Canvas>
  );
}

function Scene() {
  const topology = useBoard((s) => s.topology);
  const armedKind = useBoard((s) => s.armedKind);
  const selectedId = useBoard((s) => s.selectedId);
  const draggingId = useBoard((s) => s.draggingId);
  const placeAt = useBoard((s) => s.placeAt);
  const select = useBoard((s) => s.select);
  const beginDrag = useBoard((s) => s.beginDrag);
  const dragTo = useBoard((s) => s.dragTo);
  const endDrag = useBoard((s) => s.endDrag);

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
      const cell = worldToCell(event.point.x, event.point.z);
      if (armedKind) placeAt(cell);
      else select(null);
    },
    [armedKind, placeAt, select],
  );

  const ghostCell = armedKind && hovered && withinBoard(hovered) ? hovered : null;
  const ghostBlocked = ghostCell ? Boolean(nodeAt(topology, ghostCell)) : false;

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

      {armedKind && ghostCell && (
        <Ghost cell={ghostCell} blocked={ghostBlocked} kind={armedKind} />
      )}

      {topology.nodes.map((node) => (
        <ComponentStack
          key={node.id}
          node={node}
          selected={node.id === selectedId}
          dragging={node.id === draggingId}
          onPointerDown={(event) => {
            // Without this the floor beneath also handles the click, which
            // would place a component on top of the one being grabbed.
            event.stopPropagation();
            beginDrag(node.id);
          }}
        />
      ))}

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

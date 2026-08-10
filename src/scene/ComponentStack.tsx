import { useMemo } from 'react';
import { Html } from '@react-three/drei';
import { COMPONENT_COLORS, LINK_PICK_COLOR, SELECTED_COLOR } from './component-colors';
import { dangerTint } from './dangerColor';
import { UNIT_HEIGHT, cellToWorld, stackHeight, stackTop } from './board-geometry';
import { specFor } from '../sim/specs';
import type { PlacedNode } from '../sim/types';

const BOX = 0.72;

interface Props {
  node: PlacedNode;
  selected: boolean;
  dragging: boolean;
  /** True while this node is the picked source of a connection being drawn. */
  linkSource: boolean;
  /** Current queue depth over capacity, 0..1, while a run is playing back. */
  dangerFraction?: number;
  onPointerDown: (event: { stopPropagation: () => void }) => void;
}

/**
 * A placed component: one box per instance, stacked upward.
 *
 * The stack is the point — six boxes tall is legible as "I threw hardware at
 * this" without reading a number, which is the job the vertical axis is here
 * to do.
 */
export function ComponentStack({
  node,
  selected,
  dragging,
  linkSource,
  dangerFraction,
  onPointerDown,
}: Props) {
  const [x, , z] = cellToWorld(node.cell);
  const spec = specFor(node.kind);
  const color = dangerTint(COMPONENT_COLORS[node.kind], dangerFraction ?? 0);
  const instances = useMemo(
    () => Array.from({ length: node.replicas }, (_, i) => stackHeight(i)),
    [node.replicas],
  );
  // Selection and "picked as a wire's source" are mutually exclusive in the
  // store, but the ring colour still has to pick one if both were ever true.
  const ringColor = selected ? SELECTED_COLOR : linkSource ? LINK_PICK_COLOR : null;

  return (
    <group position={[x, 0, z]}>
      {instances.map((y, i) => (
        <mesh
          key={i}
          position={[0, y, 0]}
          onPointerDown={onPointerDown}
          castShadow
        >
          <boxGeometry args={[BOX, UNIT_HEIGHT, BOX]} />
          <meshStandardMaterial
            color={color}
            emissive={ringColor ?? '#000000'}
            emissiveIntensity={ringColor ? 0.25 : 0}
            transparent={dragging}
            opacity={dragging ? 0.55 : 1}
            roughness={0.45}
            metalness={0.1}
          />
        </mesh>
      ))}

      {ringColor && (
        <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.45, 0.52, 32]} />
          <meshBasicMaterial color={ringColor} />
        </mesh>
      )}

      {/* Labels are DOM, not 3D text. drei's <Text> renders through troika,
          which fetches a default font from a CDN at runtime — when that fetch
          fails it throws inside the render loop and takes the whole canvas
          down, leaving a blank board. A DOM label needs no network at all. */}
      <Html
        position={[0, stackTop(node.replicas) + 0.3, 0]}
        center
        // No distanceFactor: it scales a DOM label by camera distance, which
        // is meaningless under an orthographic camera and blows the label up
        // to fill the screen. Labels stay screen-sized instead.
        pointerEvents="none"
        style={{ pointerEvents: 'none' }}
        zIndexRange={[10, 0]}
      >
        <span className="node-label">
          {spec.label}
          {node.replicas > 1 && <b> ×{node.replicas}</b>}
        </span>
      </Html>
    </group>
  );
}

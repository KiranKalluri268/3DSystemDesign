import { useMemo } from 'react';
import { Quaternion, Vector3 } from 'three';
import { LINK_COLOR, LINK_SELECTED_COLOR } from './component-colors';

const UP = new Vector3(0, 1, 0);
const RADIUS = 0.035;
/** Wider than the visible wire so a thin cable is still easy to click. */
const HIT_RADIUS = 0.16;

interface Props {
  from: [number, number, number];
  to: [number, number, number];
  selected?: boolean;
  /** Preview wires are translucent and unclickable; committed wires are not. */
  preview?: boolean;
  color?: string;
  onPointerDown?: (event: { stopPropagation: () => void }) => void;
}

/**
 * A wire between two attach points, drawn as an oriented cylinder.
 *
 * A plain three.js mesh rather than drei's `<Line>` — it is one more surface
 * that could turn out to depend on something at runtime, and the board has
 * already lost an afternoon to a renderer feature that silently needed a
 * network request. A cylinder is geometry and nothing else.
 */
export function LinkLine({ from, to, selected, preview, color, onPointerDown }: Props) {
  const { position, quaternion, length } = useMemo(() => {
    const start = new Vector3(...from);
    const end = new Vector3(...to);
    const direction = end.clone().sub(start);
    const dist = direction.length();
    const mid = start.clone().add(end).multiplyScalar(0.5);
    const quat = new Quaternion().setFromUnitVectors(UP, direction.clone().normalize());
    return { position: mid, quaternion: quat, length: dist };
  }, [from, to]);

  return (
    <group position={position} quaternion={quaternion}>
      <mesh>
        <cylinderGeometry args={[RADIUS, RADIUS, length, 8]} />
        <meshBasicMaterial
          color={selected ? LINK_SELECTED_COLOR : (color ?? LINK_COLOR)}
          transparent={Boolean(preview)}
          opacity={preview ? 0.55 : 1}
        />
      </mesh>

      {/* Wider than the visible wire, purely so a thin cable is still easy to
          click. Opacity near zero rather than `visible={false}` — r3f's
          pointer events skip invisible objects during raycasting, which
          would make this hitbox silently unclickable. */}
      {!preview && (
        <mesh
          onPointerDown={(event) => {
            event.stopPropagation();
            onPointerDown?.(event);
          }}
        >
          <cylinderGeometry args={[HIT_RADIUS, HIT_RADIUS, length, 8]} />
          <meshBasicMaterial transparent opacity={0.001} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}

import { useMemo } from 'react';
import { useRun } from '../state/runStore';
import { packetPositionAt, type PacketVisualState } from './packetPosition';
import type { Cell } from '../sim/types';

const STATE_COLOR: Record<PacketVisualState, string> = {
  waiting: '#fbbf24',
  traveling: '#7dd3fc',
  completed: '#4ade80',
  dropped: '#ef4444',
};

const RADIUS = 0.09;

/**
 * The animated packets themselves: one small sphere per traced request,
 * positioned by the pure math in packetPosition.ts. Reads playbackTick
 * straight from the store, so it re-renders every frame the playback driver
 * advances — cheap enough at MAX_TRACED_PACKETS (60), which is the entire
 * reason that bound exists.
 */
export function PacketLayer() {
  const result = useRun((s) => s.result);
  const topology = useRun((s) => s.topology);
  const playbackTick = useRun((s) => s.playbackTick);

  const cellById = useMemo(() => {
    const map = new Map<string, Cell>();
    if (topology) for (const n of topology.nodes) map.set(n.id, n.cell);
    return map;
  }, [topology]);

  const clientCell = useMemo(
    () => topology?.nodes.find((n) => n.kind === 'client')?.cell ?? { x: 0, z: 0, y: 0 },
    [topology],
  );

  if (!result || !topology) return null;

  return (
    <>
      {result.trace.map((trace) => {
        const at = packetPositionAt(trace, playbackTick, (id) => cellById.get(id), clientCell);
        if (!at.visible) return null;
        return (
          <mesh key={trace.id} position={at.position}>
            <sphereGeometry args={[RADIUS, 8, 8]} />
            <meshBasicMaterial color={STATE_COLOR[at.state]} />
          </mesh>
        );
      })}
    </>
  );
}

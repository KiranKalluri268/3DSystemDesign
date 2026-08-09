import { Canvas } from '@react-three/fiber';
import { Grid, OrbitControls } from '@react-three/drei';
import { GRID_SIZE } from '../sim/constants';

/**
 * The board: an orthographic, fixed-pitch camera looking down at a grid floor.
 *
 * The camera deliberately cannot change its pitch (polar angle is pinned) —
 * placement and wiring are only predictable when "up" on screen always means
 * the same direction in the world. Yaw is free so players can orbit around a
 * topology, and zoom is free.
 */
export function Board() {
  const iso = Math.atan(Math.SQRT1_2); // classic isometric pitch, ~35.264°

  return (
    <Canvas
      orthographic
      camera={{ position: [12, 12, 12], zoom: 40, near: -100, far: 200 }}
    >
      <color attach="background" args={['#0e1116']} />
      <ambientLight intensity={0.7} />
      <directionalLight position={[8, 14, 6]} intensity={1.1} />

      <Grid
        args={[GRID_SIZE, GRID_SIZE]}
        cellSize={1}
        cellColor="#2a3441"
        sectionSize={4}
        sectionColor="#3d4c5e"
        fadeDistance={40}
        infiniteGrid={false}
      />

      <OrbitControls
        enablePan
        minPolarAngle={Math.PI / 2 - iso}
        maxPolarAngle={Math.PI / 2 - iso}
      />
    </Canvas>
  );
}

import { Board } from './scene/Board';

export function App() {
  return (
    <div className="app">
      <Board />
      <div className="hud">
        <h1>Rack</h1>
        <p>Scaffold only — the board is an empty isometric grid for now.</p>
        <p>See <code>docs/DESIGN.md</code> for the build plan.</p>
      </div>
    </div>
  );
}

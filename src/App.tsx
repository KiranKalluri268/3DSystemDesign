import { Board } from './scene/Board';
import { Palette } from './ui/Palette';
import { Inspector } from './ui/Inspector';
import { ModeBar } from './ui/ModeBar';
import { useKeyboardShortcuts } from './ui/useKeyboardShortcuts';

export function App() {
  useKeyboardShortcuts();

  return (
    <div className="app">
      <Board />

      <header className="panel title">
        <h1>Rack</h1>
        <p className="hint">
          Place components, wire them together, and drag them around. Running
          traffic through the design comes next.
        </p>
      </header>

      <ModeBar />
      <Palette />
      <Inspector />
    </div>
  );
}

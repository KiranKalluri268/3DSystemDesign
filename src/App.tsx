import { Board } from './scene/Board';
import { Palette } from './ui/Palette';
import { Inspector } from './ui/Inspector';
import { useKeyboardShortcuts } from './ui/useKeyboardShortcuts';

export function App() {
  useKeyboardShortcuts();

  return (
    <div className="app">
      <Board />

      <header className="panel title">
        <h1>Rack</h1>
        <p className="hint">
          Place components and drag them around. Wiring them together and
          running traffic come next.
        </p>
      </header>

      <Palette />
      <Inspector />
    </div>
  );
}

import { Board } from './scene/Board';
import { Palette } from './ui/Palette';
import { Inspector } from './ui/Inspector';
import { ModeBar } from './ui/ModeBar';
import { RunBar } from './ui/RunBar';
import { Hud } from './ui/Hud';
import { VerdictBanner } from './ui/VerdictBanner';
import { useKeyboardShortcuts } from './ui/useKeyboardShortcuts';

export function App() {
  useKeyboardShortcuts();

  return (
    <div className="app">
      <Board />

      <header className="panel title">
        <h1>Rack</h1>
        <p className="hint">
          Place components, wire them together, and run traffic through the
          design to see how it holds up.
        </p>
      </header>

      <ModeBar />
      <Palette />
      <Inspector />
      <RunBar />
      <Hud />
      <VerdictBanner />
    </div>
  );
}

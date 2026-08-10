import { Board } from './scene/Board';
import { Palette } from './ui/Palette';
import { Inspector } from './ui/Inspector';
import { ModeBar } from './ui/ModeBar';
import { RunBar } from './ui/RunBar';
import { Hud } from './ui/Hud';
import { VerdictBanner } from './ui/VerdictBanner';
import { BriefPanel } from './ui/BriefPanel';
import { LevelSelect } from './ui/LevelSelect';
import { useKeyboardShortcuts } from './ui/useKeyboardShortcuts';
import { useLevel } from './state/levelStore';

export function App() {
  useKeyboardShortcuts();
  const currentLevelId = useLevel((s) => s.currentLevelId);

  if (!currentLevelId) return <LevelSelect />;

  return (
    <div className="app">
      <Board />

      <div className="sidebar-left">
        <BriefPanel />
        <Palette />
      </div>
      <ModeBar />
      <Inspector />
      <RunBar />
      <Hud />
      <VerdictBanner />
    </div>
  );
}

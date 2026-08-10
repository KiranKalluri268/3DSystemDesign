import { useBoard } from '../state/store';
import { useRun } from '../state/runStore';
import { TICK_MS } from '../sim/constants';

const SPEEDS = [1, 2, 4, 8];

/**
 * Starts a run, shows playback progress, and lets you speed it up, or go
 * back to editing.
 *
 * Clearing the board's own UI state (armed palette entry, in-progress wire
 * pick, selection) belongs here rather than in either store: starting a run
 * is the one moment both stores need to agree that editing has stopped, and
 * neither store should have to know the other exists to make that happen.
 */
export function RunBar() {
  const status = useRun((s) => s.status);
  const result = useRun((s) => s.result);
  const speed = useRun((s) => s.speed);
  const playbackTick = useRun((s) => s.playbackTick);
  const setSpeed = useRun((s) => s.setSpeed);
  const resetRun = useRun((s) => s.reset);
  const topology = useBoard((s) => s.topology);

  const startRun = () => {
    const board = useBoard.getState();
    board.armKind(null);
    board.select(null);
    board.selectLink(null);
    board.setLinking(false);
    useRun.getState().start(topology);
  };

  if (status === 'editing') {
    return (
      <div className="panel runbar">
        <button type="button" className="run-button" onClick={startRun}>
          Run Traffic
        </button>
        <p className="hint">
          Build a design, then run traffic through it to see how it holds up.
        </p>
      </div>
    );
  }

  const totalSeconds = result ? result.offeredDurationSeconds : 0;
  const currentSecond = Math.min(totalSeconds, (playbackTick * TICK_MS) / 1000);

  return (
    <div className="panel runbar">
      <div className="row">
        <span className="playhead">
          {status === 'running'
            ? `${currentSecond.toFixed(0)}s / ${totalSeconds.toFixed(0)}s`
            : 'Finished'}
        </span>
        <div className="speeds">
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              className={s === speed ? 'chip armed' : 'chip'}
              onClick={() => setSpeed(s)}
              disabled={status !== 'running'}
            >
              {s}×
            </button>
          ))}
        </div>
      </div>
      <button type="button" className="danger" onClick={resetRun}>
        {status === 'running' ? 'Stop' : 'Edit again'}
      </button>
    </div>
  );
}

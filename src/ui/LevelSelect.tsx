import { LEVELS, SANDBOX_LEVEL } from '../levels';
import { useLevel } from '../state/levelStore';
import { useBoard } from '../state/store';
import { useRun } from '../state/runStore';
import { OBJECTIVE_LABELS, formatObjectiveValue } from './format';
import type { ObjectiveKey } from '../sim/score';
import type { Level } from '../sim/types';

/**
 * The entry screen: pick a level or free play. Shown whenever no level is
 * selected, which is also the only state a fresh visit starts in.
 */
export function LevelSelect() {
  const selectLevel = useLevel((s) => s.selectLevel);

  const choose = (level: Level) => {
    // A level always starts from an empty board, and any state left over
    // from a previous attempt (armed palette entry, a run in progress)
    // would otherwise leak into the next one.
    useBoard.getState().reset();
    useRun.getState().reset();
    selectLevel(level.id);
  };

  return (
    <div className="level-select">
      <div className="level-select-inner">
        <h1>Rack</h1>
        <p className="hint">
          Build a system, run traffic through it, and see how it holds up.
        </p>
        <ul>
          {LEVELS.map((level, i) => (
            <li key={level.id}>
              <button type="button" className="level-card" onClick={() => choose(level)}>
                <span className="level-number">Level {i + 1}</span>
                <h2>{level.title}</h2>
                <p>{level.brief}</p>
                <Targets level={level} />
              </button>
            </li>
          ))}
          <li>
            <button
              type="button"
              className="level-card"
              onClick={() => choose(SANDBOX_LEVEL)}
            >
              <span className="level-number">Free play</span>
              <h2>{SANDBOX_LEVEL.title}</h2>
              <p>{SANDBOX_LEVEL.brief}</p>
              <Targets level={SANDBOX_LEVEL} />
            </button>
          </li>
        </ul>
      </div>
    </div>
  );
}

function Targets({ level }: { level: Level }) {
  const entries = Object.entries(level.objective) as Array<[ObjectiveKey, number]>;
  return (
    <dl className="targets">
      {entries.map(([key, value]) => (
        <div key={key}>
          <dt>{OBJECTIVE_LABELS[key]}</dt>
          <dd>{formatObjectiveValue(key, value)}</dd>
        </div>
      ))}
    </dl>
  );
}

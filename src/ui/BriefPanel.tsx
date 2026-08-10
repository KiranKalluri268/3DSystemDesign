import { getLevel } from '../levels';
import { useLevel } from '../state/levelStore';
import { useBoard } from '../state/store';
import { useRun } from '../state/runStore';
import { OBJECTIVE_LABELS, formatObjectiveValue } from './format';
import type { ObjectiveKey } from '../sim/score';

/**
 * The active level's brief and targets, shown in place of a generic title
 * while editing. Hides once a run starts — the HUD and verdict banner take
 * over the same job of telling the player where they stand.
 */
export function BriefPanel() {
  const editing = useRun((s) => s.status) === 'editing';
  const currentLevelId = useLevel((s) => s.currentLevelId);
  const exitToLevelSelect = useLevel((s) => s.exitToLevelSelect);

  if (!editing) return null;

  const level = currentLevelId ? getLevel(currentLevelId) : undefined;
  if (!level) return null;

  const entries = Object.entries(level.objective) as Array<[ObjectiveKey, number]>;

  const changeLevel = () => {
    // Leaving mid-attempt is the same as never having started one -- the
    // board and any run should not carry over into the next choice.
    useBoard.getState().reset();
    useRun.getState().reset();
    exitToLevelSelect();
  };

  return (
    <header className="panel title">
      <h1>Rack</h1>
      <h2 className="level-title">{level.title}</h2>
      <p className="hint">{level.brief}</p>
      {entries.length > 0 && (
        <dl className="targets">
          {entries.map(([key, value]) => (
            <div key={key}>
              <dt>{OBJECTIVE_LABELS[key]}</dt>
              <dd>{formatObjectiveValue(key, value)}</dd>
            </div>
          ))}
        </dl>
      )}
      <button type="button" className="link-button" onClick={changeLevel}>
        Change level
      </button>
    </header>
  );
}

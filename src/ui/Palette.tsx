import { NODE_SPECS } from '../sim/specs';
import { COMPONENT_COLORS } from '../scene/component-colors';
import { useBoard } from '../state/store';
import { useRun } from '../state/runStore';
import { useLevel } from '../state/levelStore';
import { getLevel } from '../levels';
import type { NodeKind } from '../sim/types';

const ALL_KINDS = Object.keys(NODE_SPECS) as NodeKind[];

export function Palette() {
  const editing = useRun((s) => s.status) === 'editing';
  const armedKind = useBoard((s) => s.armedKind);
  const armKind = useBoard((s) => s.armKind);
  const currentLevelId = useLevel((s) => s.currentLevelId);

  if (!editing) return null;

  // Filtered against the roster's own order rather than the level's array
  // order, so a level file listing its palette in whatever order it likes
  // doesn't reshuffle the panel.
  const level = currentLevelId ? getLevel(currentLevelId) : undefined;
  const allowed = level ? new Set(level.palette) : new Set(ALL_KINDS);
  const kinds = ALL_KINDS.filter((kind) => allowed.has(kind));

  return (
    <aside className="panel palette">
      <h2>Components</h2>
      <p className="hint">
        Pick one, then click the floor to place it. Keep clicking to add more.
      </p>
      <ul>
        {kinds.map((kind) => {
          const spec = NODE_SPECS[kind];
          const armed = armedKind === kind;
          return (
            <li key={kind}>
              <button
                type="button"
                className={armed ? 'chip armed' : 'chip'}
                onClick={() => armKind(armed ? null : kind)}
                aria-pressed={armed}
              >
                <span
                  className="swatch"
                  style={{ background: COMPONENT_COLORS[kind] }}
                  aria-hidden
                />
                <span className="chip-label">{spec.label}</span>
                <span className="chip-cost">
                  {spec.costPerHour > 0 ? `$${spec.costPerHour}/hr` : 'free'}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

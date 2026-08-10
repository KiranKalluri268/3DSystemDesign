import { NODE_SPECS } from '../sim/specs';
import { COMPONENT_COLORS } from '../scene/component-colors';
import { useBoard } from '../state/store';
import { useRun } from '../state/runStore';
import type { NodeKind } from '../sim/types';

/** Every kind for now; a level will hand its own allowed palette in phase 5. */
const ALL_KINDS = Object.keys(NODE_SPECS) as NodeKind[];

export function Palette() {
  const editing = useRun((s) => s.status) === 'editing';
  const armedKind = useBoard((s) => s.armedKind);
  const armKind = useBoard((s) => s.armKind);

  if (!editing) return null;

  return (
    <aside className="panel palette">
      <h2>Components</h2>
      <p className="hint">
        Pick one, then click the floor to place it. Keep clicking to add more.
      </p>
      <ul>
        {ALL_KINDS.map((kind) => {
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

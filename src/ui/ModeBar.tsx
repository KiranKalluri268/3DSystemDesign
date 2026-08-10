import { useBoard } from '../state/store';
import { useRun } from '../state/runStore';

/**
 * Switches the board between placing components and wiring them.
 *
 * A separate mode rather than a modifier key, because wiring is a sequence
 * of clicks (pick a source, click each target) and a held key does not
 * survive across them.
 */
export function ModeBar() {
  const editing = useRun((s) => s.status) === 'editing';
  const linking = useBoard((s) => s.linking);
  const linkFrom = useBoard((s) => s.linkFrom);
  const setLinking = useBoard((s) => s.setLinking);

  if (!editing) return null;

  return (
    <div className="panel modebar">
      <button
        type="button"
        className={linking ? 'chip' : 'chip armed'}
        aria-pressed={!linking}
        onClick={() => setLinking(false)}
      >
        Place
      </button>
      <button
        type="button"
        className={linking ? 'chip armed' : 'chip'}
        aria-pressed={linking}
        onClick={() => setLinking(true)}
      >
        Connect
      </button>
      <p className="hint">
        {linking
          ? linkFrom
            ? 'Click a component to connect to it. Click the source again to cancel.'
            : 'Click a component to start a connection from it.'
          : 'Pick a component from the palette, then click the floor to place it.'}
      </p>
    </div>
  );
}

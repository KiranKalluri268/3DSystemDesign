import { useRun } from '../state/runStore';
import { formatObjectiveValue } from './format';

/**
 * The moment a run resolves into pass or fail.
 *
 * The explanation text is the whole point — scoreRun already names the
 * responsible component and the mechanism, never just "objective failed",
 * so this only has to display it, not compose it.
 */
export function VerdictBanner() {
  const status = useRun((s) => s.status);
  const verdict = useRun((s) => s.verdict);

  if (status !== 'finished' || !verdict) return null;

  return (
    <div className={verdict.passed ? 'panel verdict pass' : 'panel verdict fail'}>
      <h2>{verdict.passed ? 'Holds up' : "Didn't hold"}</h2>

      {verdict.explanation && <p className="explanation">{verdict.explanation}</p>}

      {verdict.objectives.length > 0 && (
        <dl className="stats">
          {verdict.objectives.map((o) => (
            <div key={o.key}>
              <dt>{o.label}</dt>
              <dd className={o.passed ? 'ok' : 'bad'}>
                {formatObjectiveValue(o.key, o.actual)} (target{' '}
                {formatObjectiveValue(o.key, o.target)})
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

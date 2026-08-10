import { useRun } from '../state/runStore';
import { TICK_MS } from '../sim/constants';

/**
 * Live metrics while a run plays back, reading the engine's per-second
 * history rather than recomputing anything — the same snapshot the node
 * danger tint reads from, just the aggregate view instead of the per-node one.
 */
export function Hud() {
  const status = useRun((s) => s.status);
  const result = useRun((s) => s.result);
  const playbackTick = useRun((s) => s.playbackTick);

  if (status === 'editing' || !result || result.history.length === 0) return null;

  const second = Math.min(
    Math.floor((playbackTick * TICK_MS) / 1000),
    result.history.length - 1,
  );
  const snapshot = status === 'finished'
    ? result.history[result.history.length - 1]!
    : result.history[second]!;

  return (
    <div className="panel hud">
      <h2>Live</h2>
      <dl className="stats">
        <div>
          <dt>p50 latency</dt>
          <dd>{snapshot.p50LatencyMs}ms</dd>
        </div>
        <div>
          <dt>p99 latency</dt>
          <dd>{snapshot.p99LatencyMs}ms</dd>
        </div>
        <div>
          <dt>Throughput</dt>
          <dd>{Math.round(snapshot.throughputRps)} req/s</dd>
        </div>
        <div>
          <dt>Error rate</dt>
          <dd>{(snapshot.errorRate * 100).toFixed(1)}%</dd>
        </div>
        <div>
          <dt>Cost</dt>
          <dd>${result.metrics.costPerHour.toFixed(2)}/hr</dd>
        </div>
      </dl>
    </div>
  );
}

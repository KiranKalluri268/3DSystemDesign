import { specFor } from '../sim/specs';
import { costPerHour } from '../sim/specs';
import { MAX_REPLICAS } from '../state/topology';
import { useBoard } from '../state/store';

/**
 * Details for the selected component, and the controls that change it.
 *
 * Capacity and cost are shown for the whole stack rather than per instance,
 * because the question a player is asking is "is this tier big enough", not
 * "what does one box do".
 */
export function Inspector() {
  const topology = useBoard((s) => s.topology);
  const selectedId = useBoard((s) => s.selectedId);
  const scaleSelected = useBoard((s) => s.scaleSelected);
  const deleteSelected = useBoard((s) => s.deleteSelected);

  const node = topology.nodes.find((n) => n.id === selectedId);
  const total = costPerHour(topology.nodes);

  return (
    <aside className="panel inspector">
      <h2>Selection</h2>

      {!node && (
        <p className="hint">
          Nothing selected. Click a component on the board to inspect it.
        </p>
      )}

      {node && (
        <>
          <h3>{specFor(node.kind).label}</h3>
          <dl className="stats">
            <div>
              <dt>Instances</dt>
              <dd>{node.replicas}</dd>
            </div>
            <div>
              <dt>Capacity</dt>
              <dd>
                {Number.isFinite(specFor(node.kind).capacityRps)
                  ? `${(specFor(node.kind).capacityRps * node.replicas).toLocaleString()} req/s`
                  : 'unlimited'}
              </dd>
            </div>
            <div>
              <dt>Latency</dt>
              <dd>{specFor(node.kind).baseLatencyMs}ms</dd>
            </div>
            <div>
              <dt>Cost</dt>
              <dd>
                {specFor(node.kind).costPerHour > 0
                  ? `$${(specFor(node.kind).costPerHour * node.replicas).toFixed(2)}/hr`
                  : 'free'}
              </dd>
            </div>
          </dl>

          <div className="row">
            <button
              type="button"
              onClick={() => scaleSelected(-1)}
              disabled={node.replicas <= 1}
              aria-label="Remove an instance"
            >
              −
            </button>
            <span className="replicas">{node.replicas} / {MAX_REPLICAS}</span>
            <button
              type="button"
              onClick={() => scaleSelected(1)}
              disabled={node.replicas >= MAX_REPLICAS}
              aria-label="Add an instance"
            >
              +
            </button>
          </div>

          <button type="button" className="danger" onClick={deleteSelected}>
            Remove component
          </button>
        </>
      )}

      <hr />
      <dl className="stats">
        <div>
          <dt>Components</dt>
          <dd>{topology.nodes.length}</dd>
        </div>
        <div>
          <dt>Running cost</dt>
          <dd>${total.toFixed(2)}/hr</dd>
        </div>
      </dl>
    </aside>
  );
}

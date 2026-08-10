import { costPerHour, specFor } from '../sim/specs';
import { MAX_REPLICAS, linksTouching } from '../state/topology';
import { useBoard } from '../state/store';
import { useRun } from '../state/runStore';

/**
 * Details for the selection, and the controls that change it.
 *
 * Shows a component or a connection, never both — the store keeps the two
 * selections mutually exclusive. Capacity and cost are reported for the
 * whole stack rather than per instance, because the question a player is
 * asking is "is this tier big enough", not "what does one box do".
 */
export function Inspector() {
  const editing = useRun((s) => s.status) === 'editing';
  const topology = useBoard((s) => s.topology);
  const selectedId = useBoard((s) => s.selectedId);
  const selectedLinkId = useBoard((s) => s.selectedLinkId);
  const scaleSelected = useBoard((s) => s.scaleSelected);
  const deleteSelected = useBoard((s) => s.deleteSelected);
  const deleteSelectedLink = useBoard((s) => s.deleteSelectedLink);

  const node = topology.nodes.find((n) => n.id === selectedId);
  const link = topology.links.find((l) => l.id === selectedLinkId);
  const linkFromNode = link ? topology.nodes.find((n) => n.id === link.from) : undefined;
  const linkToNode = link ? topology.nodes.find((n) => n.id === link.to) : undefined;
  const total = costPerHour(topology.nodes);

  if (!editing) return null;

  return (
    <aside className="panel inspector">
      <h2>Selection</h2>

      {!node && !link && (
        <p className="hint">
          Nothing selected. Click a component or a connection on the board to
          inspect it.
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
            <div>
              <dt>Connections</dt>
              <dd>{linksTouching(topology, node.id).length}</dd>
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

      {link && linkFromNode && linkToNode && (
        <>
          <h3>Connection</h3>
          <p className="hint">
            {specFor(linkFromNode.kind).label} sends traffic to{' '}
            {specFor(linkToNode.kind).label}.
          </p>
          <button type="button" className="danger" onClick={deleteSelectedLink}>
            Remove connection
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
          <dt>Connections</dt>
          <dd>{topology.links.length}</dd>
        </div>
        <div>
          <dt>Running cost</dt>
          <dd>${total.toFixed(2)}/hr</dd>
        </div>
      </dl>
    </aside>
  );
}

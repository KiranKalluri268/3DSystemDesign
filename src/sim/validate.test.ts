import { describe, expect, it } from 'vitest';
import { validateTopology } from './validate';
import type { NodeKind, Topology } from './types';

let seq = 0;
function node(id: string, kind: NodeKind, replicas = 1) {
  return { id, kind, replicas, cell: { x: 0, z: 0, y: 0 } };
}
function link(from: string, to: string) {
  return { id: `l${seq++}`, from, to };
}
function topology(
  nodes: Topology['nodes'],
  links: Topology['links'] = [],
): Topology {
  return { nodes, links };
}

/** The canonical legal shape: client → LB → api → db. */
function healthy(): Topology {
  return topology(
    [
      node('c', 'client'),
      node('lb', 'load_balancer'),
      node('api', 'api_server'),
      node('db', 'sql_primary'),
    ],
    [link('c', 'lb'), link('lb', 'api'), link('api', 'db')],
  );
}

const codes = (t: Topology) => validateTopology(t).map((i) => i.code);

describe('validateTopology', () => {
  it('passes a well-formed topology', () => {
    expect(validateTopology(healthy())).toEqual([]);
  });

  it('requires a traffic source', () => {
    expect(codes(topology([node('api', 'api_server')]))).toContain('no_client');
  });

  it('rejects a client wired to nothing', () => {
    // The engine ends a path at any component with nothing downstream, so an
    // unwired client would otherwise complete every request instantly and
    // score an empty design as perfect.
    expect(codes(topology([node('c', 'client')]))).toContain('client_not_connected');
  });

  it('rejects a second client', () => {
    const t = healthy();
    t.nodes.push(node('c2', 'client'));
    expect(codes(t)).toContain('multiple_clients');
  });

  it('rejects links to components that were deleted', () => {
    const t = healthy();
    t.links.push(link('api', 'ghost'));
    expect(codes(t)).toContain('dangling_link');
  });

  it('rejects a component calling itself', () => {
    const t = healthy();
    t.links.push(link('api', 'api'));
    expect(codes(t)).toContain('self_link');
  });

  it('rejects the same connection made twice', () => {
    const t = healthy();
    t.links.push(link('lb', 'api'));
    expect(codes(t)).toContain('duplicate_link');
  });

  it('rejects a connection the roster forbids', () => {
    const t = topology(
      [node('c', 'client'), node('db', 'sql_primary')],
      [link('c', 'db')],
    );
    expect(codes(t)).toContain('illegal_connection');
  });

  it('rejects a component scaled to zero instances', () => {
    const t = healthy();
    t.nodes[2]!.replicas = 0;
    expect(codes(t)).toContain('invalid_replicas');
  });

  it('flags a component nothing routes to', () => {
    const t = healthy();
    t.nodes.push(node('orphan', 'cache'));
    const issues = validateTopology(t);
    expect(issues.map((i) => i.code)).toContain('unreachable_node');
    expect(issues.find((i) => i.code === 'unreachable_node')?.nodeId).toBe('orphan');
  });

  it('catches a cycle rather than letting the engine loop forever', () => {
    // The roster forbids this shape, but a saved file could still contain it,
    // and runSimulation assumes acyclic.
    const t = topology(
      [node('c', 'client'), node('a', 'api_server'), node('b', 'api_server')],
      [link('c', 'a'), link('a', 'b'), link('b', 'a')],
    );
    expect(codes(t)).toContain('cycle');
  });

  it('terminates on a cycle that is not reachable from the client', () => {
    const t = healthy();
    t.nodes.push(node('x', 'api_server'), node('y', 'api_server'));
    t.links.push(link('x', 'y'), link('y', 'x'));
    // Unreachable, so no cycle report, but it must still return.
    expect(codes(t)).toContain('unreachable_node');
  });

  it('writes messages for a player, not for a console', () => {
    for (const issue of validateTopology(topology([node('api', 'api_server')]))) {
      expect(issue.message).not.toMatch(/undefined|null|[a-z]+[A-Z][a-z]+\(/);
      expect(issue.message.length).toBeGreaterThan(10);
    }
  });
});

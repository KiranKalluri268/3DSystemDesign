import { specFor } from './specs';
import type { Topology } from './types';

export interface ValidationIssue {
  /** Machine-readable so the UI can decide how to surface it. */
  code:
    | 'no_client'
    | 'multiple_clients'
    | 'dangling_link'
    | 'self_link'
    | 'duplicate_link'
    | 'illegal_connection'
    | 'invalid_replicas'
    | 'unreachable_node'
    | 'cycle';
  /** Player-facing wording. Names the mechanism, not the internals. */
  message: string;
  nodeId?: string;
  linkId?: string;
}

/**
 * Structural checks that must pass before a topology can be run.
 *
 * This is the gate the engine trusts: `runSimulation` assumes exactly one
 * client and an acyclic graph, and would loop forever on a cycle. It is also
 * what CI uses to prove every shipped level's reference solution is legal.
 */
export function validateTopology(topology: Topology): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const byId = new Map(topology.nodes.map((n) => [n.id, n]));

  const clients = topology.nodes.filter((n) => n.kind === 'client');
  if (clients.length === 0) {
    issues.push({
      code: 'no_client',
      message: 'Nothing is sending traffic. Place a client to start a run.',
    });
  } else if (clients.length > 1) {
    issues.push({
      code: 'multiple_clients',
      message: 'A run has a single source of traffic. Remove the extra client.',
    });
  }

  for (const node of topology.nodes) {
    if (!Number.isInteger(node.replicas) || node.replicas < 1) {
      issues.push({
        code: 'invalid_replicas',
        message: `${specFor(node.kind).label} needs at least one instance.`,
        nodeId: node.id,
      });
    }
  }

  const seenPairs = new Set<string>();
  for (const link of topology.links) {
    const from = byId.get(link.from);
    const to = byId.get(link.to);

    if (!from || !to) {
      issues.push({
        code: 'dangling_link',
        message: 'A connection points at a component that is no longer there.',
        linkId: link.id,
      });
      continue;
    }

    if (link.from === link.to) {
      issues.push({
        code: 'self_link',
        message: `${specFor(from.kind).label} cannot call itself.`,
        linkId: link.id,
      });
      continue;
    }

    const pair = `${link.from}->${link.to}`;
    if (seenPairs.has(pair)) {
      issues.push({
        code: 'duplicate_link',
        message: 'These two components are already connected.',
        linkId: link.id,
      });
      continue;
    }
    seenPairs.add(pair);

    if (!specFor(from.kind).canConnectTo.includes(to.kind)) {
      issues.push({
        code: 'illegal_connection',
        message: `${specFor(from.kind).label} cannot send traffic to ${specFor(to.kind).label}.`,
        linkId: link.id,
      });
    }
  }

  const client = clients[0];
  if (client) {
    issues.push(...findUnreachable(topology, client.id));
    issues.push(...findCycle(topology, client.id));
  }

  return issues;
}

function outgoing(topology: Topology, nodeId: string): string[] {
  return topology.links.filter((l) => l.from === nodeId).map((l) => l.to);
}

function findUnreachable(topology: Topology, clientId: string): ValidationIssue[] {
  const reached = new Set<string>();
  const stack = [clientId];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (reached.has(id)) continue;
    reached.add(id);
    for (const next of outgoing(topology, id)) stack.push(next);
  }

  return topology.nodes
    .filter((n) => !reached.has(n.id))
    .map((n) => ({
      code: 'unreachable_node' as const,
      message: `${specFor(n.kind).label} receives no traffic — nothing connects to it.`,
      nodeId: n.id,
    }));
}

function findCycle(topology: Topology, clientId: string): ValidationIssue[] {
  const visiting = new Set<string>();
  const done = new Set<string>();
  let cycleAt: string | null = null;

  const walk = (id: string): void => {
    if (cycleAt !== null || done.has(id)) return;
    if (visiting.has(id)) {
      cycleAt = id;
      return;
    }
    visiting.add(id);
    for (const next of outgoing(topology, id)) walk(next);
    visiting.delete(id);
    done.add(id);
  };
  walk(clientId);

  const found: string | null = cycleAt;
  if (found === null) return [];
  const node = topology.nodes.find((n) => n.id === found);
  return [
    {
      code: 'cycle',
      message: `Requests loop back to ${node ? specFor(node.kind).label : 'a component'} and never finish.`,
      nodeId: found,
    },
  ];
}

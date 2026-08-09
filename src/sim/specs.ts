import type { NodeKind, NodeSpec } from './types';

/**
 * The component roster.
 *
 * These numbers are teaching instruments, not measurements. They are chosen
 * so the intuition a player builds is the right one — a single API server
 * saturates long before a load balancer does, a cache is an order of
 * magnitude faster than the database behind it, a worker is slow but cheap —
 * and not to predict any real system's behaviour.
 *
 * Changing a number here changes whether existing levels are winnable. Every
 * level's reference solution is re-checked in CI for exactly this reason.
 */
export const NODE_SPECS: Record<NodeKind, NodeSpec> = {
  client: {
    kind: 'client',
    label: 'Client',
    capacityRps: Infinity,
    baseLatencyMs: 0,
    costPerHour: 0,
    canConnectTo: ['dns', 'cdn', 'load_balancer', 'api_server'],
  },
  dns: {
    kind: 'dns',
    label: 'DNS',
    capacityRps: 50_000,
    baseLatencyMs: 20,
    costPerHour: 0.5,
    canConnectTo: ['cdn', 'load_balancer'],
  },
  cdn: {
    kind: 'cdn',
    label: 'CDN',
    capacityRps: 40_000,
    baseLatencyMs: 15,
    costPerHour: 4,
    // A CDN serves most requests from the edge; the rest fall through.
    hitRatio: 0.8,
    canConnectTo: ['load_balancer', 'object_store'],
  },
  load_balancer: {
    kind: 'load_balancer',
    label: 'Load Balancer',
    capacityRps: 20_000,
    baseLatencyMs: 2,
    costPerHour: 2,
    canConnectTo: ['api_server'],
  },
  api_server: {
    kind: 'api_server',
    label: 'API Server',
    capacityRps: 400,
    baseLatencyMs: 30,
    costPerHour: 1,
    canConnectTo: ['cache', 'sql_primary', 'sql_replica', 'object_store', 'queue'],
  },
  cache: {
    kind: 'cache',
    label: 'Cache',
    capacityRps: 30_000,
    baseLatencyMs: 1,
    costPerHour: 3,
    // The headline lesson of level 2: a cache only helps for what it holds.
    hitRatio: 0.85,
    canConnectTo: ['sql_primary', 'sql_replica'],
  },
  sql_primary: {
    kind: 'sql_primary',
    label: 'SQL Primary',
    capacityRps: 800,
    baseLatencyMs: 20,
    costPerHour: 6,
    canConnectTo: [],
  },
  sql_replica: {
    kind: 'sql_replica',
    label: 'SQL Replica',
    capacityRps: 1_200,
    baseLatencyMs: 20,
    costPerHour: 4,
    canConnectTo: [],
  },
  object_store: {
    kind: 'object_store',
    label: 'Object Store',
    capacityRps: 20_000,
    baseLatencyMs: 40,
    costPerHour: 1,
    canConnectTo: [],
  },
  queue: {
    kind: 'queue',
    label: 'Queue',
    capacityRps: 50_000,
    baseLatencyMs: 1,
    costPerHour: 1,
    canConnectTo: ['worker'],
  },
  worker: {
    kind: 'worker',
    label: 'Worker',
    capacityRps: 5,
    baseLatencyMs: 200,
    costPerHour: 0.5,
    canConnectTo: ['sql_primary', 'object_store'],
  },
};

export function specFor(kind: NodeKind): NodeSpec {
  return NODE_SPECS[kind];
}

/** Total hourly cost of a topology, counting every replica. */
export function costPerHour(
  nodes: Array<{ kind: NodeKind; replicas: number }>,
): number {
  let total = 0;
  for (const node of nodes) {
    total += specFor(node.kind).costPerHour * node.replicas;
  }
  // Costs are compared against level budgets; round to cents so floating
  // point noise never fails a design that exactly meets its budget.
  return Math.round(total * 100) / 100;
}

/**
 * Core simulation vocabulary.
 *
 * Everything in `src/sim` is pure TypeScript with no React and no Three.js
 * imports — the engine must be runnable in a plain Node test. The 3D layer
 * reads simulation output; it never feeds rendering concerns back in.
 */

export type NodeKind =
  | 'client'
  | 'dns'
  | 'cdn'
  | 'load_balancer'
  | 'api_server'
  | 'cache'
  | 'sql_primary'
  | 'sql_replica'
  | 'object_store'
  | 'queue'
  | 'worker';

/** Where a node sits on the board. Integer cell coordinates; y is stack height. */
export interface Cell {
  x: number;
  z: number;
  y: number;
}

/** The static capability sheet for a kind of component. */
export interface NodeSpec {
  kind: NodeKind;
  label: string;
  /** Requests per second a single instance can serve before queueing. */
  capacityRps: number;
  /** Service time in ms at low load, before queueing delay. */
  baseLatencyMs: number;
  /** Dollars per hour per instance, for the budget scoring. */
  costPerHour: number;
  /**
   * Fraction of requests this node answers itself instead of forwarding
   * downstream — a cache or CDN hit. Absent means every request served here
   * continues to the next node.
   */
  hitRatio?: number;
  /** Kinds this node is allowed to send traffic to. */
  canConnectTo: NodeKind[];
}

/** A placed instance of a component. */
export interface PlacedNode {
  id: string;
  kind: NodeKind;
  cell: Cell;
  /** Horizontally scaled replicas, drawn as a stack. */
  replicas: number;
}

export interface Link {
  id: string;
  from: string;
  to: string;
}

export interface Topology {
  nodes: PlacedNode[];
  links: Link[];
}

/** What a level asks the player to achieve, checked after a traffic run. */
export interface Objective {
  maxP99LatencyMs?: number;
  maxErrorRate?: number;
  maxCostPerHour?: number;
  minThroughputRps?: number;
}

export interface Level {
  id: string;
  title: string;
  brief: string;
  /** Kinds the player is allowed to place in this level. */
  palette: NodeKind[];
  /** Offered traffic over the run, as (second, rps) waypoints. */
  trafficProfile: Array<{ atSecond: number; rps: number }>;
  objective: Objective;
}

/** Aggregate result of one traffic run. */
export interface RunMetrics {
  p50LatencyMs: number;
  p99LatencyMs: number;
  throughputRps: number;
  errorRate: number;
  costPerHour: number;
}

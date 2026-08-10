import type { ObjectiveKey } from '../sim/score';

/**
 * Shared with scoreRun's own labels on purpose — an objective reads the
 * same whether it's a level's target shown before a run or a verdict's
 * result shown after one.
 */
export const OBJECTIVE_LABELS: Record<ObjectiveKey, string> = {
  maxP99LatencyMs: 'p99 latency',
  maxErrorRate: 'error rate',
  maxCostPerHour: 'cost',
  minThroughputRps: 'throughput',
};

export function formatObjectiveValue(key: string, value: number): string {
  if (key === 'maxErrorRate') return `${(value * 100).toFixed(1)}%`;
  if (key === 'maxCostPerHour') return `$${value.toFixed(2)}/hr`;
  if (key === 'minThroughputRps') return `${Math.round(value)} req/s`;
  return `${Math.round(value)}ms`;
}

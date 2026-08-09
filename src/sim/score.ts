import type { NodeStats, RunResult } from './engine';
import { specFor } from './specs';
import type { Level, Objective, RunMetrics, Topology } from './types';

export type ObjectiveKey = keyof Objective;

export interface ObjectiveResult {
  key: ObjectiveKey;
  label: string;
  passed: boolean;
  actual: number;
  target: number;
}

export interface Verdict {
  passed: boolean;
  objectives: ObjectiveResult[];
  /**
   * Why the run failed, in terms of the component responsible. Empty on a
   * pass. This is the teaching moment — "objective failed" wastes it.
   */
  explanation: string;
}

const formatMs = (v: number) => `${Math.round(v)}ms`;
const formatPct = (v: number) => `${(v * 100).toFixed(1)}%`;
const formatRps = (v: number) => `${Math.round(v)} req/s`;
const formatCost = (v: number) => `$${v.toFixed(2)}/hr`;

export function scoreRun(
  result: RunResult,
  level: Level,
  topology: Topology,
): Verdict {
  if (result.issues.length > 0) {
    return {
      passed: false,
      objectives: [],
      explanation: result.issues[0]!.message,
    };
  }

  const objectives = checkObjectives(result.metrics, level.objective);
  const passed = objectives.every((o) => o.passed);

  return {
    passed,
    objectives,
    explanation: passed
      ? ''
      : explainFailure(result, topology, objectives.filter((o) => !o.passed)),
  };
}

function checkObjectives(metrics: RunMetrics, objective: Objective): ObjectiveResult[] {
  const results: ObjectiveResult[] = [];

  if (objective.maxP99LatencyMs !== undefined) {
    results.push({
      key: 'maxP99LatencyMs',
      label: 'p99 latency',
      actual: metrics.p99LatencyMs,
      target: objective.maxP99LatencyMs,
      passed: metrics.p99LatencyMs <= objective.maxP99LatencyMs,
    });
  }
  if (objective.maxErrorRate !== undefined) {
    results.push({
      key: 'maxErrorRate',
      label: 'error rate',
      actual: metrics.errorRate,
      target: objective.maxErrorRate,
      passed: metrics.errorRate <= objective.maxErrorRate,
    });
  }
  if (objective.minThroughputRps !== undefined) {
    results.push({
      key: 'minThroughputRps',
      label: 'throughput',
      actual: metrics.throughputRps,
      target: objective.minThroughputRps,
      passed: metrics.throughputRps >= objective.minThroughputRps,
    });
  }
  if (objective.maxCostPerHour !== undefined) {
    results.push({
      key: 'maxCostPerHour',
      label: 'cost',
      actual: metrics.costPerHour,
      target: objective.maxCostPerHour,
      passed: metrics.costPerHour <= objective.maxCostPerHour,
    });
  }

  return results;
}

/**
 * Turn a failed run into the sentence the player actually learns from.
 *
 * Always names a mechanism and, where there is one, the component
 * responsible: which component shed the load, or which one everything was
 * waiting behind.
 */
function explainFailure(
  result: RunResult,
  topology: Topology,
  failures: ObjectiveResult[],
): string {
  const label = (stats: NodeStats): string => {
    const node = topology.nodes.find((n) => n.id === stats.nodeId);
    return node ? specFor(node.kind).label : 'A component';
  };

  const worstDrop = [...result.nodeStats].sort((a, b) => b.dropped - a.dropped)[0];
  const busiest = [...result.nodeStats].sort((a, b) => b.utilization - a.utilization)[0];

  if (worstDrop && worstDrop.dropped > 0) {
    const share = worstDrop.dropped / Math.max(result.dropped, 1);
    const culprit = label(worstDrop);
    const reason =
      worstDrop.dropsByReason.queue_full >= worstDrop.dropsByReason.timeout
        ? `${culprit} ran out of capacity and started shedding requests`
        : `requests waited behind ${culprit} until they timed out`;
    return (
      `${result.dropped.toLocaleString()} requests failed — ${reason}. ` +
      `It accounts for ${formatPct(share)} of the failures, ` +
      `and its queue peaked at ${worstDrop.peakQueueDepth.toLocaleString()} waiting requests. ` +
      `Give it more capacity, or take work off it.`
    );
  }

  const latency = failures.find((f) => f.key === 'maxP99LatencyMs');
  if (latency && busiest) {
    return (
      `Nothing failed outright, but p99 reached ${formatMs(latency.actual)} against ` +
      `a ${formatMs(latency.target)} target. ${label(busiest)} was the busiest component ` +
      `at ${formatPct(busiest.utilization)} of its capacity — a component near its limit ` +
      `queues requests, and queueing is what the slowest 1% are waiting in.`
    );
  }

  const cost = failures.find((f) => f.key === 'maxCostPerHour');
  if (cost) {
    return (
      `The design works but costs ${formatCost(cost.actual)} against a ` +
      `${formatCost(cost.target)} budget. Over-provisioning is a way to lose: ` +
      `find the component with capacity to spare and scale it down.`
    );
  }

  const throughput = failures.find((f) => f.key === 'minThroughputRps');
  if (throughput) {
    return (
      `Only ${formatRps(throughput.actual)} got through, against a ` +
      `${formatRps(throughput.target)} target. Traffic is being held up before it ` +
      `reaches the end of the path.`
    );
  }

  return 'The design did not meet its objectives.';
}

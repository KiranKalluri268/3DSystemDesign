import { NODE_SPECS } from '../sim/specs';
import type { Level, NodeKind } from '../sim/types';

/**
 * The free-play scenario Run mode uses before real levels exist.
 *
 * Not level 1 — phase 5 defines actual levels as their own files, each with
 * its own brief and a proven reference solution. This is scaffolding for
 * testing Run mode itself, so it reuses the exact numbers from the pitch in
 * docs/DESIGN.md §1 rather than inventing a new scenario: "100 → 8,000 req/s
 * over two minutes, p99 under 300ms, error rate under 1%, budget $40/hr."
 */
export const SANDBOX_LEVEL: Level = {
  id: 'sandbox',
  title: 'Front page',
  brief:
    'Your app just hit the front page. Traffic climbs from 100 to 8,000 ' +
    'req/s over two minutes — build something that holds.',
  // Free play: every component the roster has, since there is no curated
  // level to restrict the palette to yet.
  palette: Object.keys(NODE_SPECS) as NodeKind[],
  trafficProfile: [
    { atSecond: 0, rps: 100 },
    { atSecond: 120, rps: 8000 },
  ],
  objective: {
    maxP99LatencyMs: 300,
    maxErrorRate: 0.01,
    maxCostPerHour: 40,
  },
};

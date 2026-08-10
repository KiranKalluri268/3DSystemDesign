import type { Level } from '../sim/types';

/**
 * Level 1 — one server, one problem.
 *
 * The whole lesson is horizontal scaling behind a load balancer. No
 * database in the palette on purpose: an API server with nothing downstream
 * is a legitimate design (the engine completes the request right there), so
 * nothing about this level requires anything past a client, a load balancer
 * and however many API servers it takes.
 */
export const LEVEL_1: Level = {
  id: 'level-1',
  title: 'One server, one problem',
  brief:
    'Your API runs on a single server, and it is about to get busy. ' +
    'Traffic climbs from 100 to 2,500 req/s over a minute — one server ' +
    'cannot take that alone.',
  palette: ['client', 'load_balancer', 'api_server'],
  trafficProfile: [
    { atSecond: 0, rps: 100 },
    { atSecond: 60, rps: 2500 },
  ],
  objective: {
    maxP99LatencyMs: 200,
    maxErrorRate: 0.01,
  },
};

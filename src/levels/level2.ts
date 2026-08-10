import type { Level } from '../sim/types';

/**
 * Level 2 — the slow query.
 *
 * The API tier from level 1 scales fine; the database behind it does not.
 * A cache absorbs most of the read traffic (NodeSpec.hitRatio), which is
 * the only lesson this level teaches — it does not model staleness or
 * invalidation, so the brief does not promise either.
 */
export const LEVEL_2: Level = {
  id: 'level-2',
  title: 'The slow query',
  brief:
    'You scaled the API tier and it held. Now the database is the ' +
    'bottleneck: every request still has to reach it. Traffic climbs from ' +
    '100 to 2,500 req/s over a minute — put something in front of it.',
  palette: ['client', 'load_balancer', 'api_server', 'cache', 'sql_primary'],
  trafficProfile: [
    { atSecond: 0, rps: 100 },
    { atSecond: 60, rps: 2500 },
  ],
  objective: {
    maxP99LatencyMs: 250,
    maxErrorRate: 0.01,
  },
};

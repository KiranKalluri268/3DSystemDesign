import { LEVEL_1 } from './level1';
import { LEVEL_2 } from './level2';
import { SANDBOX_LEVEL } from './sandbox';
import type { Level } from '../sim/types';

/** Curated levels, in play order. Free play (the sandbox) is separate — it isn't "level 3". */
export const LEVELS: Level[] = [LEVEL_1, LEVEL_2];

export { SANDBOX_LEVEL };

export function getLevel(id: string): Level | undefined {
  if (id === SANDBOX_LEVEL.id) return SANDBOX_LEVEL;
  return LEVELS.find((l) => l.id === id);
}

import { Color } from 'three';

const DANGER = new Color('#ef4444');

/**
 * Blends a component's resting colour toward red as its queue fills up.
 *
 * This is the visual the whole pitch in docs/DESIGN.md §1 is built on — "the
 * database block turns amber, then red" — so it has to read continuously,
 * not as a snap at some threshold. `fraction` is the node's current queue
 * depth over its capacity bound (`NodeStats.maxQueue`), already computed by
 * the engine; this only interpolates colour.
 */
export function dangerTint(baseHex: string, fraction: number): string {
  if (fraction <= 0) return baseHex;
  const base = new Color(baseHex);
  const blended = base.clone().lerp(DANGER, Math.min(1, fraction));
  return `#${blended.getHexString()}`;
}

import { describe, expect, it } from 'vitest';
import { LEVELS, SANDBOX_LEVEL, getLevel } from './index';

describe('level registry', () => {
  it('lists curated levels in play order', () => {
    expect(LEVELS.map((l) => l.id)).toEqual(['level-1', 'level-2']);
  });

  it('does not count the sandbox as a curated level', () => {
    expect(LEVELS.some((l) => l.id === SANDBOX_LEVEL.id)).toBe(false);
  });

  it('looks up a curated level by id', () => {
    expect(getLevel('level-1')?.title).toBe('One server, one problem');
  });

  it('looks up the sandbox by id too', () => {
    expect(getLevel(SANDBOX_LEVEL.id)).toBe(SANDBOX_LEVEL);
  });

  it('returns undefined for an unknown id rather than throwing', () => {
    expect(getLevel('nope')).toBeUndefined();
  });

  it('gives every level a unique id', () => {
    const ids = [...LEVELS, SANDBOX_LEVEL].map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

import { describe, expect, it } from 'vitest';
import { dangerTint } from './dangerColor';

describe('dangerTint', () => {
  it('returns the base colour untouched at zero', () => {
    expect(dangerTint('#34d399', 0)).toBe('#34d399');
  });

  it('returns pure red at full', () => {
    expect(dangerTint('#34d399', 1)).toBe('#ef4444');
  });

  it('clamps a fraction past one to full red', () => {
    expect(dangerTint('#34d399', 5)).toBe(dangerTint('#34d399', 1));
  });

  it('moves monotonically toward red as the fraction climbs', () => {
    const toRed = (hex: string) => parseInt(hex.slice(1, 3), 16);
    const half = dangerTint('#34d399', 0.5);
    const full = dangerTint('#34d399', 1);
    const none = dangerTint('#34d399', 0);
    expect(toRed(half)).toBeGreaterThan(toRed(none));
    expect(toRed(full)).toBeGreaterThanOrEqual(toRed(half));
  });
});

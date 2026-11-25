import { describe, expect, it } from 'vitest';
import {
  createDefaultSettings,
  normalizeQuickAccess,
  parseSettings,
  QUICK_ACCESS_SLOTS,
  setQuickAccessSlot,
} from '../../src/core/settings/settings';

const KNOWN = ['a', 'b', 'c'];

describe('settings', () => {
  it('defaults to system theme and exactly 5 quick access slots', () => {
    const s = createDefaultSettings();
    expect(s.theme).toBe('system');
    expect(s.quickAccess).toHaveLength(QUICK_ACCESS_SLOTS);
  });

  it('recovers from corrupted stored data without throwing', () => {
    for (const raw of [null, 42, 'x', [], { theme: 'purple', quickAccess: 'no' }]) {
      const s = parseSettings(raw, KNOWN);
      expect(['system', 'light', 'dark']).toContain(s.theme);
      expect(s.quickAccess).toHaveLength(QUICK_ACCESS_SLOTS);
    }
  });

  it('keeps a valid stored theme', () => {
    expect(parseSettings({ theme: 'dark' }, KNOWN).theme).toBe('dark');
  });

  it('drops unknown and duplicate actions from quick access', () => {
    expect(normalizeQuickAccess(['a', 'zzz', 'a', 'b', 7, 'c'], KNOWN)).toEqual([
      'a',
      null,
      null,
      'b',
      null,
    ]);
  });

  it('moving an action to another slot frees the old slot', () => {
    expect(setQuickAccessSlot(['a', 'b', null, null, null], 3, 'a')).toEqual([
      null,
      'b',
      null,
      'a',
      null,
    ]);
  });

  it('ignores out-of-range slots', () => {
    const slots = ['a', null, null, null, null];
    expect(setQuickAccessSlot(slots, 9, 'b')).toEqual(slots);
  });
});

import { describe, expect, it } from 'vitest';
import { defaultToolPrefs, parseToolPrefs } from '../../src/features/board/toolPrefs';

describe('tool prefs', () => {
  it('recovers from corrupted data', () => {
    for (const raw of [null, 3, 'x', { pen: { color: 'red', width: 9999 } }]) {
      const p = parseToolPrefs(raw);
      expect(p.pen.color).toMatch(/^#[0-9a-f]{6}$/);
      expect(p.pen.width).toBeLessThanOrEqual(60);
    }
  });

  it('keeps valid values', () => {
    const p = parseToolPrefs({
      ...defaultToolPrefs(),
      pen: { color: '#AA0000', width: 12, opacity: 0.5 },
    });
    expect(p.pen).toEqual({ color: '#aa0000', width: 12, opacity: 0.5 });
  });
});

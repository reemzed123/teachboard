import { describe, expect, it } from 'vitest';
import { IDENTITY_TRANSFORM, type InkObject } from '../../src/core/document/types';
import {
  eraseInkCircle,
  inkBounds,
  inkHitsPoint,
  inkIntersectsRect,
  simplifyClosePoints,
} from '../../src/core/ink/ink';

// קו ישר אופקי מ-(0,0) עד (100,0), עובי 4, מוזז ל-(10,20)
const line: InkObject = {
  id: 'l',
  type: 'ink',
  transform: { ...IDENTITY_TRANSFORM, x: 10, y: 20 },
  style: { kind: 'pen', color: '#000000', width: 4, opacity: 1 },
  points: [0, 0, 0.5, 50, 0, 0.5, 100, 0, 0.5],
  pressure: false,
};

describe('ink geometry', () => {
  it('bounds include position and stroke width', () => {
    expect(inkBounds(line)).toEqual({ x: 8, y: 18, width: 104, height: 4 });
  });

  it('hit test respects width and tolerance', () => {
    expect(inkHitsPoint(line, 60, 21, 0)).toBe(true);
    expect(inkHitsPoint(line, 60, 30, 0)).toBe(false);
    expect(inkHitsPoint(line, 60, 30, 10)).toBe(true);
  });

  it('rectangle selection', () => {
    expect(inkIntersectsRect(line, { x: 40, y: 0, width: 5, height: 50 })).toBe(true);
    expect(inkIntersectsRect(line, { x: 40, y: 30, width: 5, height: 50 })).toBe(false);
  });
});

describe('area eraser', () => {
  it('returns null when the eraser misses', () => {
    expect(eraseInkCircle(line, 60, 100, 5)).toBeNull();
  });

  it('cuts a straight line in the middle into two pieces', () => {
    const pieces = eraseInkCircle(line, 60, 20, 5)!;
    expect(pieces).toHaveLength(2);
    for (const p of pieces) {
      expect(p.id).not.toBe('l');
      expect(p.style).toEqual(line.style);
      // אף נקודה שנשארה לא בתוך המחק
      for (let i = 0; i < p.points.length; i += 3) {
        expect(Math.abs(p.points[i]! + 10 - 60)).toBeGreaterThan(5);
      }
    }
  });

  it('removes the line completely when fully covered', () => {
    expect(eraseInkCircle(line, 60, 20, 100)).toEqual([]);
  });
});

describe('simplify', () => {
  it('drops near-duplicate points but keeps the last one', () => {
    const pts = [0, 0, 0.5, 0.1, 0, 0.5, 0.2, 0, 0.5, 10, 0, 0.5, 10.1, 0, 0.6];
    expect(simplifyClosePoints(pts, 1)).toEqual([0, 0, 0.5, 10, 0, 0.5, 10.1, 0, 0.6]);
  });
});

import { describe, expect, it } from 'vitest';
import { IDENTITY_TRANSFORM, type GraphObject } from '../../src/core/document/types';
import {
  defaultRange,
  functionName,
  panGraph,
  resizeGraph,
  zoomGraph,
} from '../../src/core/math/graphView';

const g: GraphObject = {
  id: 'g',
  type: 'graph',
  transform: { ...IDENTITY_TRANSFORM, x: 100, y: 100 },
  width: 400,
  height: 300,
  range: { xMin: -8, xMax: 8, yMin: -6, yMax: 6 },
  grid: true,
  showIntercepts: true,
  showIntersections: true,
  functions: [],
};

describe('graph view', () => {
  it('names functions f, g, h, ...', () => {
    expect([0, 1, 2].map(functionName)).toEqual(['f', 'g', 'h']);
  });

  it('enlarging the frame from the bottom-right corner shows more of the plane, same unit size', () => {
    const out = resizeGraph(g, { x: 100, y: 100 }, 2); // ציר בפינה העליונה-שמאלית
    expect(out.width).toBe(800);
    expect(out.height).toBe(600);
    expect(out.transform.scale).toBe(1);
    // פיקסלים ליחידה נשארים זהים
    expect(out.width / (out.range.xMax - out.range.xMin)).toBeCloseTo(400 / 16);
    // הפינה העליונה-שמאלית נשארת אותה נקודה במישור
    expect(out.range.xMin).toBeCloseTo(-8);
    expect(out.range.yMax).toBeCloseTo(6);
    expect(out.range.xMax).toBeCloseTo(24);
    expect(out.range.yMin).toBeCloseTo(-18);
  });

  it('zoom and pan', () => {
    expect(zoomGraph(g, 0.5)).toEqual({ xMin: -4, xMax: 4, yMin: -3, yMax: 3 });
    expect(panGraph(g, 0.25, 0)).toEqual({ xMin: -4, xMax: 12, yMin: -6, yMax: 6 });
  });

  it('default range keeps equal units', () => {
    const r = defaultRange(480, 360);
    expect((r.xMax - r.xMin) / 480).toBeCloseTo((r.yMax - r.yMin) / 360);
  });
});

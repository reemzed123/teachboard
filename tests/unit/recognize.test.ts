import { describe, expect, it } from 'vitest';
import { recognizeShape } from '../../src/core/ink/recognize';

/** קו יד מדומה: נקודות לאורך מסלול + רעד קטן קבוע */
function along(path: [number, number][], perSeg = 20, jitter = 1.5): number[] {
  const out: number[] = [];
  let k = 0;
  for (let i = 0; i + 1 < path.length; i++) {
    const [x1, y1] = path[i]!;
    const [x2, y2] = path[i + 1]!;
    for (let j = 0; j < perSeg; j++) {
      const t = j / perSeg;
      const wob = Math.sin(k++ * 1.7) * jitter;
      out.push(x1 + (x2 - x1) * t + wob, y1 + (y2 - y1) * t - wob, 0.5);
    }
  }
  const [lx, ly] = path[path.length - 1]!;
  out.push(lx, ly, 0.5);
  return out;
}

function circle(cx: number, cy: number, rx: number, ry: number, jitter = 2): number[] {
  const out: number[] = [];
  for (let i = 0; i <= 60; i++) {
    const a = (i / 60) * Math.PI * 2 + 0.3;
    const wob = Math.sin(i * 2.3) * jitter;
    out.push(cx + (rx + wob) * Math.cos(a), cy + (ry + wob) * Math.sin(a), 0.5);
  }
  return out;
}

describe('hold-to-shape recognition', () => {
  it('a roughly straight stroke becomes a clean line between its ends', () => {
    const s = recognizeShape(
      along([
        [0, 0],
        [200, 10],
      ]),
      30,
    );
    expect(s?.kind).toBe('line');
    expect(s!.points.length).toBe(4);
  });

  it('triangle, rectangle, tilted quadrilateral', () => {
    expect(
      recognizeShape(
        along([
          [0, 200],
          [100, 0],
          [200, 200],
          [0, 200],
        ]),
        30,
      )?.kind,
    ).toBe('triangle');
    const rect = recognizeShape(
      along([
        [0, 0],
        [300, 2],
        [302, 150],
        [1, 152],
        [0, 0],
      ]),
      30,
    );
    expect(rect?.kind).toBe('rectangle');
    expect(rect!.points.length).toBe(10); // 4 פינות + סגירה
    expect(
      recognizeShape(
        along([
          [0, 50],
          [150, 0],
          [250, 120],
          [60, 200],
          [0, 50],
        ]),
        30,
      )?.kind,
    ).toBe('quad');
  });

  it('circle and ellipse', () => {
    expect(recognizeShape(circle(100, 100, 80, 80), 30)?.kind).toBe('circle');
    expect(recognizeShape(circle(100, 100, 140, 60), 30)?.kind).toBe('ellipse');
  });

  it('leaves handwriting and small marks alone', () => {
    // "S" – לא קו, לא סגור
    const s: number[] = [];
    for (let i = 0; i <= 40; i++) s.push(50 * Math.sin((i / 40) * Math.PI * 2), i * 5, 0.5);
    expect(recognizeShape(s, 30)).toBeNull();
    // סימן קטן מדי
    expect(
      recognizeShape(
        along([
          [0, 0],
          [10, 1],
        ]),
        30,
      ),
    ).toBeNull();
    // לולאה עקומה (כמו האות e) – לא מעגל
    const e: number[] = [];
    for (let i = 0; i <= 50; i++) {
      const a = (i / 50) * Math.PI * 1.7;
      e.push(60 * Math.cos(a) + i, 40 * Math.sin(a), 0.5);
    }
    expect(recognizeShape(e, 30)).toBeNull();
  });
});

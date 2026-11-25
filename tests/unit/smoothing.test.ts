import { describe, expect, it } from 'vitest';
import { beautifyStroke, OneEuroFilter2D, radiusForPressure } from '../../src/core/ink/smoothing';

/** סטיית תקן של y – מדד ל"רעד" סביב קו אופקי */
function jitter(ys: number[]): number {
  const m = ys.reduce((a, b) => a + b, 0) / ys.length;
  return Math.sqrt(ys.reduce((a, b) => a + (b - m) ** 2, 0) / ys.length);
}

let seed = 3;
const noise = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * 2;

describe('One Euro filter', () => {
  it('reduces tremor when the pen moves slowly', () => {
    const f = new OneEuroFilter2D(1.6, 0.012);
    const raw: number[] = [];
    const out: number[] = [];
    for (let i = 0; i < 200; i++) {
      const y = 100 + noise() * 1.5; // רעד של ±1.5 פיקסל
      raw.push(y);
      out.push(f.filter(i * 0.5, y, i / 200).y); // 100px/s – איטי
    }
    expect(jitter(out.slice(20))).toBeLessThan(jitter(raw.slice(20)) * 0.5);
  });

  it('adds very little lag when the pen moves fast', () => {
    const f = new OneEuroFilter2D(1.6, 0.012);
    let last = { x: 0, y: 0 };
    for (let i = 0; i <= 50; i++) last = f.filter(i * 20, 0, i / 200); // 4000px/s
    // אחרי 50 דגימות העט ב-x=1000; הנקודה המסוננת קרובה אליו
    expect(1000 - last.x).toBeLessThan(25);
  });
});

describe('beautifyStroke', () => {
  const line = (n: number, jit = 0) => {
    const pts: number[] = [];
    for (let i = 0; i < n; i++) pts.push(i * 3, 50 + (jit ? noise() * jit : 0), 0.5);
    return pts;
  };

  it('level 0 leaves the stroke untouched', () => {
    const pts = line(40, 2);
    expect(beautifyStroke(pts, 0)).toEqual(pts);
  });

  it('smooths shaky lines but keeps the endpoints', () => {
    const pts = line(80, 2);
    const out = beautifyStroke(pts, 2);
    const ys = (a: number[]) => a.filter((_, i) => i % 3 === 1);
    expect(jitter(ys(out))).toBeLessThan(jitter(ys(pts)) * 0.6);
    expect(out.slice(-3, -1)).toEqual(pts.slice(-3, -1));
  });

  it('removes a small hook at the start of a stroke', () => {
    // וו: 3 נקודות שזזות למטה-שמאלה, ואז קו ארוך ימינה
    const hook = [6, 0, 0.5, 4, 2, 0.5, 2, 4, 0.5];
    const main: number[] = [];
    for (let i = 0; i < 40; i++) main.push(2 + i * 3, 4, 0.5);
    const out = beautifyStroke([...hook, ...main], 1);
    expect(out[0]).toBeGreaterThanOrEqual(2);
    expect(out[1]).toBeCloseTo(4, 0);
  });

  it('smooths sudden pressure changes', () => {
    const pts: number[] = [];
    for (let i = 0; i < 30; i++) pts.push(i * 3, 0, i % 2 ? 0.9 : 0.1);
    const out = beautifyStroke(pts, 2);
    const ps = out.filter((_, i) => i % 3 === 2).slice(5, -5);
    expect(Math.max(...ps) - Math.min(...ps)).toBeLessThan(0.2);
  });
});

describe('radiusForPressure', () => {
  it('matches the final renderer range', () => {
    expect(radiusForPressure(10, 0.6, 1)).toBeCloseTo(8);
    expect(radiusForPressure(10, 0.6, 0)).toBeCloseTo(2);
    expect(radiusForPressure(10, 0, 0.2)).toBeCloseTo(5);
  });
});

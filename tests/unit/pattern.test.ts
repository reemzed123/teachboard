import { describe, expect, it } from 'vitest';
import { generatePattern, isDarkColor } from '../../src/core/background/pattern';
import { createPage } from '../../src/features/board/boardStore';

const area = { x: 0, y: 0, width: 400, height: 300 };

describe('background pattern', () => {
  it('blank page has no lines', () => {
    expect(generatePattern(createPage(), area, 1).lines).toHaveLength(0);
  });

  it('grid draws lines every spacing, only inside the page', () => {
    const page = createPage({ background: { pattern: 'grid', color: '#ffffff', spacing: 50 } });
    const p = generatePattern(page, { x: -500, y: -500, width: 900, height: 800 }, 1);
    for (const l of p.lines) {
      expect(l.x1).toBeGreaterThanOrEqual(0);
      expect(l.y1).toBeGreaterThanOrEqual(0);
    }
    expect(p.lines.filter((l) => l.x1 === l.x2).length).toBe(9); // x = 0,50..400
  });

  it('skips lines that would be too dense when zoomed out', () => {
    const page = createPage({ background: { pattern: 'grid', color: '#ffffff', spacing: 20 } });
    expect(generatePattern(page, area, 0.1).lines).toHaveLength(0);
  });

  it('math paper has a major line every 5 squares', () => {
    const page = createPage({ background: { pattern: 'math', color: '#ffffff', spacing: 20 } });
    const p = generatePattern(page, area, 1);
    const majorX = p.lines.filter((l) => l.kind === 'major' && l.x1 === l.x2).map((l) => l.x1);
    expect(majorX).toEqual([0, 100, 200, 300, 400]);
  });

  it('axes have two axis lines, arrows and numbers', () => {
    const page = createPage({ background: { pattern: 'axes', color: '#ffffff', spacing: 32 } });
    const p = generatePattern(page, { x: 0, y: 0, ...page.size }, 1);
    expect(p.lines.filter((l) => l.kind === 'axis')).toHaveLength(2);
    expect(p.arrows).toHaveLength(2);
    expect(p.labels.map((l) => l.text)).toContain('1');
    expect(p.labels.map((l) => l.text)).toContain('-1');
  });

  it('lined page in notebook layout has a margin line', () => {
    const page = createPage({ background: { pattern: 'lines', color: '#ffffff', spacing: 32 } });
    expect(
      generatePattern(page, { x: 0, y: 0, ...page.size }, 1).lines.some((l) => l.kind === 'margin'),
    ).toBe(true);
  });

  it('infinite board fills the visible area', () => {
    const page = createPage({
      layout: 'infinite',
      background: { pattern: 'grid', color: '#ffffff', spacing: 100 },
    });
    const p = generatePattern(page, { x: -1000, y: -1000, width: 500, height: 500 }, 1);
    expect(p.lines.length).toBeGreaterThan(0);
  });

  it('detects dark board colors', () => {
    expect(isDarkColor('#24413a')).toBe(true);
    expect(isDarkColor('#ffffff')).toBe(false);
  });
});

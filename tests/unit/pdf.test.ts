import { describe, expect, it } from 'vitest';
import { isPdf, pdfLevel } from '../../src/features/lessons/assetCache';
import { rotatedPagePlacement } from '../../src/features/export/pdf';
import { validateDocument } from '../../src/core/format/validate';

describe('PDF pages', () => {
  it('recognises PDF files by their first bytes', () => {
    expect(isPdf(new TextEncoder().encode('%PDF-1.4 ...'))).toBe(true);
    expect(isPdf(new TextEncoder().encode('<html>'))).toBe(false);
  });

  it('picks a sharper rendering when zooming in, within a memory limit', () => {
    const a4 = { width: 793, height: 1123 };
    expect(pdfLevel(0.3, a4)).toBe(1);
    expect(pdfLevel(1, a4)).toBe(1);
    expect(pdfLevel(2.5, a4)).toBe(3);
    expect(pdfLevel(20, a4)).toBeLessThanOrEqual(Math.sqrt(24_000_000 / (793 * 1123)));
  });

  it('places rotated original pages so they fill the page the right way', () => {
    const rect = { x: 0, y: 0, width: 300, height: 400 };
    expect(rotatedPagePlacement(rect, 0)).toEqual(rect);
    expect(rotatedPagePlacement(rect, 90)).toMatchObject({ x: 0, y: 400, width: 400, height: 300 });
    expect(rotatedPagePlacement(rect, 180)).toMatchObject({ x: 300, y: 400, width: 300 });
    expect(rotatedPagePlacement(rect, 270)).toMatchObject({ x: 300, y: 0, width: 400 });
  });

  it('validates the PDF reference of a page background', () => {
    const page = (pdf: unknown) => ({
      version: 1,
      pages: [
        {
          id: 'p1',
          layout: 'bounded',
          size: { width: 100, height: 100 },
          background: { pattern: 'none', color: '#ffffff', spacing: 32, pdf },
          objects: [],
        },
      ],
    });
    const ok = validateDocument(page({ assetId: 'a'.repeat(64), page: 2.7 }));
    expect(ok.pages[0]!.background.pdf).toEqual({ assetId: 'a'.repeat(64), page: 2 });
    expect(
      validateDocument(page({ assetId: '../x', page: 0 })).pages[0]!.background.pdf,
    ).toBeUndefined();
    expect(
      validateDocument(page({ assetId: 'a'.repeat(64), page: -1 })).pages[0]!.background.pdf,
    ).toBeUndefined();
  });
});

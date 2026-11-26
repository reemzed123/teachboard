import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { packBoardFile, unpackBoardFile, FILE_LIMITS } from '../../src/core/format/boardFile';
import { FormatError } from '../../src/core/format/validate';
import { IDENTITY_TRANSFORM } from '../../src/core/document/types';
import { createEmptyDocument } from '../../src/features/board/boardStore';

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const ASSET = 'a'.repeat(64);

function sampleDoc() {
  const doc = createEmptyDocument();
  doc.pages[0]!.objects.push({
    id: 'ink1',
    type: 'ink',
    transform: IDENTITY_TRANSFORM,
    style: { kind: 'pen', color: '#112233', width: 3, opacity: 1 },
    points: [0, 0, 0.5, 4, 4, 0.6],
    pressure: true,
  });
  doc.pages[0]!.background = {
    pattern: 'grid',
    color: '#ffffff',
    spacing: 30,
    imageAssetId: ASSET,
  };
  return doc;
}

const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return (e as FormatError).code;
  }
  return 'ok';
};

function zip(files: Record<string, string | Uint8Array>) {
  return zipSync(
    Object.fromEntries(
      Object.entries(files).map(([k, v]) => [k, typeof v === 'string' ? strToU8(v) : v]),
    ),
  );
}

const manifest = JSON.stringify({ format: 'teachboard', formatVersion: 1, title: 'x' });

describe('.board file', () => {
  it('round-trips a lesson with its background image', () => {
    const doc = sampleDoc();
    const bytes = packBoardFile(
      { title: 'שברים', doc, assets: [{ id: ASSET, type: 'image/png', data: PNG }] },
      '0.1',
    );
    const out = unpackBoardFile(bytes);
    expect(out.title).toBe('שברים');
    expect(out.doc).toEqual(doc);
    expect(out.assets).toHaveLength(1);
    expect([...out.assets[0]!.data]).toEqual([...PNG]);
  });

  it('rejects files that are not .board files', () => {
    expect(code(() => unpackBoardFile(strToU8('hello')))).toBe('notDocument');
    expect(code(() => unpackBoardFile(zip({ 'a.txt': 'x' })))).toBe('notDocument');
    expect(
      code(() =>
        unpackBoardFile(zip({ 'manifest.json': '{"format":"other"}', 'document.json': '{}' })),
      ),
    ).toBe('notDocument');
  });

  it('rejects files from a newer version', () => {
    const m = JSON.stringify({ format: 'teachboard', formatVersion: 99 });
    expect(code(() => unpackBoardFile(zip({ 'manifest.json': m, 'document.json': '{}' })))).toBe(
      'newerVersion',
    );
  });

  it('rejects broken JSON', () => {
    expect(
      code(() => unpackBoardFile(zip({ 'manifest.json': manifest, 'document.json': '{oops' }))),
    ).toBe('invalid');
  });

  it('ignores unexpected files (e.g. scripts, path tricks) inside the zip', () => {
    const doc = createEmptyDocument();
    const bytes = zip({
      'manifest.json': manifest,
      'document.json': JSON.stringify(doc),
      '../../evil.exe': 'MZ',
      'script.js': 'alert(1)',
    });
    expect(unpackBoardFile(bytes).doc.pages).toHaveLength(1);
  });

  it('refuses a "zip bomb" (huge content when unpacked)', () => {
    const big = new Uint8Array(FILE_LIMITS.documentBytes + 10); // אפסים – נדחס לגודל זעיר
    const bytes = zipSync({ 'manifest.json': strToU8(manifest), 'document.json': big });
    expect(bytes.length).toBeLessThan(1_000_000);
    expect(code(() => unpackBoardFile(bytes))).toBe('tooLarge');
  }, 60_000); // בונה קובץ של 200MB בזיכרון – איטי במחשבי הבדיקה של GitHub

  it('drops a background image that is not really an image', () => {
    const doc = sampleDoc();
    const bytes = zip({
      'manifest.json': manifest,
      'document.json': JSON.stringify(doc),
      [`assets/${ASSET}`]: '<svg onload="alert(1)"/>',
    });
    const out = unpackBoardFile(bytes);
    expect(out.assets).toHaveLength(0);
    expect(out.doc.pages[0]!.background.imageAssetId).toBeUndefined();
  });

  it('keeps PDF pages and the original PDF file unchanged', () => {
    const PDF = strToU8('%PDF-1.7\n% test\n%%EOF');
    const PDF_ID = 'b'.repeat(64);
    const doc = createEmptyDocument();
    doc.pages[0]!.size = { width: 793, height: 1123 };
    doc.pages[0]!.background = {
      pattern: 'none',
      color: '#ffffff',
      spacing: 32,
      pdf: { assetId: PDF_ID, page: 3 },
    };
    const out = unpackBoardFile(
      packBoardFile(
        { title: 'pdf', doc, assets: [{ id: PDF_ID, type: 'application/pdf', data: PDF }] },
        '0.1',
      ),
    );
    expect(out.doc.pages[0]!.background.pdf).toEqual({ assetId: PDF_ID, page: 3 });
    expect(out.assets[0]!.type).toBe('application/pdf');
    expect([...out.assets[0]!.data]).toEqual([...PDF]);
  });

  it('drops a PDF page reference when the PDF is missing', () => {
    const doc = createEmptyDocument();
    doc.pages[0]!.background = {
      pattern: 'none',
      color: '#ffffff',
      spacing: 32,
      pdf: { assetId: 'c'.repeat(64), page: 0 },
    };
    const out = unpackBoardFile(
      zip({ 'manifest.json': manifest, 'document.json': JSON.stringify(doc) }),
    );
    expect(out.doc.pages[0]!.background.pdf).toBeUndefined();
  });
});

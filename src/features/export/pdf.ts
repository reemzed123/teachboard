import { visibleObjects } from '../../core/document/layers';
import {
  BlendMode,
  degrees,
  LineCapStyle,
  PDFDocument,
  rgb,
  StandardFonts,
  type PDFEmbeddedPage,
  type PDFImage,
  type PDFPage,
} from 'pdf-lib';
import {
  generatePattern,
  LINE_WIDTH_PX,
  patternColors,
  ZONE_LINE,
  zoneLines,
} from '../../core/background/pattern';
import type {
  BoardDocument,
  GeometryObject,
  GraphObject,
  MathObject,
  Page,
  ShapeObject,
  TableObject,
  TextObject,
} from '../../core/document/types';
import { arrowHeadSize, localBounds } from '../../core/objects/geometry';
import { dashPattern, drawObjectLocal } from '../../engine/render/drawObject';
import { outlinePolygon, polygonToSvgPath } from '../../engine/render/inkOutline';
import { canvasToBlob, exportArea } from './renderPage';

// ייצוא PDF וקטורי: קווי כתב היד והרקע נשמרים כצורות (חדים בכל הגדלה ובהדפסה).

/** פיקסל (96 לאינץ') → נקודת PDF (72 לאינץ') */
const PX_TO_PT = 0.75;
/** גודל עמוד מקסימלי שמותר ב-PDF (בנקודות) */
const MAX_PT = 14000;

export interface PdfAssets {
  /** בתים של תמונת רקע לפי מזהה, כבר כ-PNG או JPEG */
  get(assetId: string): Promise<{ type: 'image/png' | 'image/jpeg'; data: Uint8Array } | null>;
  /** הבתים של קובץ PDF מקורי (לעמודי PDF) */
  pdf?(assetId: string): Promise<Uint8Array | null>;
  /** גיבוי: תמונת PNG חדה של רקע העמוד, כשאי אפשר להטמיע את ה-PDF (למשל קובץ מוצפן) */
  pdfPageImage?(page: Page): Promise<Uint8Array | null>;
}

/** מטמון לייצוא אחד: תמונות, ומסמכי/עמודי PDF מקוריים */
interface ExportCache {
  images: Map<string, PDFImage>;
  pdfDocs: Map<string, PDFDocument | null>;
  pdfPages: Map<string, PDFEmbeddedPage | null>;
}

/** סיבוב העמוד המקורי (0/90/180/270) – PDF.js מציג אותו מסובב, ולכן גם בייצוא */
function pdfRotation(cache: ExportCache, bg: { assetId: string; page: number }): number {
  const src = cache.pdfDocs.get(bg.assetId);
  if (!src || bg.page >= src.getPageCount()) return 0;
  const r = src.getPage(bg.page).getRotation().angle;
  return (((Math.round(r / 90) * 90) % 360) + 360) % 360;
}

/** מיקום עמוד מוטמע כך שאחרי סיבוב (עם כיוון השעון) הוא ממלא בדיוק את המלבן */
export function rotatedPagePlacement(
  rect: { x: number; y: number; width: number; height: number },
  rotation: number,
) {
  const { x, y, width: w, height: h } = rect;
  switch (rotation) {
    case 90:
      return { x, y: y + h, width: h, height: w, rotate: degrees(-90) };
    case 180:
      return { x: x + w, y: y + h, width: w, height: h, rotate: degrees(-180) };
    case 270:
      return { x: x + w, y, width: h, height: w, rotate: degrees(-270) };
    default:
      return rect;
  }
}

/** מטמיע עמוד מה-PDF המקורי כמו שהוא (וקטורי – טקסט וקווים נשארים חדים) */
async function embedPdfPage(
  pdf: PDFDocument,
  assets: PdfAssets,
  cache: ExportCache,
  assetId: string,
  index: number,
): Promise<PDFEmbeddedPage | null> {
  const key = `${assetId}:${index}`;
  if (cache.pdfPages.has(key)) return cache.pdfPages.get(key)!;
  let src = cache.pdfDocs.get(assetId);
  if (src === undefined) {
    const bytes = await assets.pdf?.(assetId);
    src = bytes ? await PDFDocument.load(bytes, { updateMetadata: false }).catch(() => null) : null;
    cache.pdfDocs.set(assetId, src);
  }
  let embedded: PDFEmbeddedPage | null = null;
  if (src && index < src.getPageCount()) {
    embedded = await pdf.embedPage(src.getPage(index)).catch(() => null);
  }
  cache.pdfPages.set(key, embedded);
  return embedded;
}

function parseColor(css: string): { color: ReturnType<typeof rgb>; opacity: number } {
  const hex = /^#([0-9a-f]{6})$/i.exec(css);
  if (hex) {
    const n = parseInt(hex[1]!, 16);
    return {
      color: rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255),
      opacity: 1,
    };
  }
  const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/.exec(css);
  if (m) {
    return {
      color: rgb(Number(m[1]) / 255, Number(m[2]) / 255, Number(m[3]) / 255),
      opacity: m[4] === undefined ? 1 : Number(m[4]),
    };
  }
  return { color: rgb(0, 0, 0), opacity: 1 };
}

async function addPage(pdf: PDFDocument, page: Page, assets: PdfAssets, cache: ExportCache) {
  const imageCache = cache.images;
  const area = exportArea(page);
  const k = Math.min(PX_TO_PT, MAX_PT / Math.max(area.width, area.height));
  const W = area.width * k;
  const H = area.height * k;
  const out: PDFPage = pdf.addPage([W, H]);
  /** קואורדינטות לוח → PDF (ציר y הפוך) */
  const X = (x: number) => (x - area.x) * k;
  const Y = (y: number) => H - (y - area.y) * k;

  const bg = parseColor(page.background.color);
  out.drawRectangle({ x: 0, y: 0, width: W, height: H, color: bg.color });

  const imageId = page.background.imageAssetId;
  if (imageId) {
    let img = imageCache.get(imageId);
    if (!img) {
      const a = await assets.get(imageId);
      if (a) {
        img = a.type === 'image/png' ? await pdf.embedPng(a.data) : await pdf.embedJpg(a.data);
        imageCache.set(imageId, img);
      }
    }
    if (img) {
      out.drawImage(img, {
        x: X(0),
        y: Y(page.size.height),
        width: page.size.width * k,
        height: page.size.height * k,
      });
    }
  }

  // עמוד PDF מקורי – מוטמע כמו שהוא, ומעליו כל מה שנכתב
  const pdfBg = page.background.pdf;
  if (pdfBg) {
    const embedded = await embedPdfPage(pdf, assets, cache, pdfBg.assetId, pdfBg.page);
    const rect = {
      x: X(0),
      y: Y(page.size.height),
      width: page.size.width * k,
      height: page.size.height * k,
    };
    if (embedded) out.drawPage(embedded, rotatedPagePlacement(rect, pdfRotation(cache, pdfBg)));
    else {
      const png = await assets.pdfPageImage?.(page);
      if (png) out.drawImage(await pdf.embedPng(png), rect);
    }
  }

  // חלוקה לאזורים
  const zc = parseColor(ZONE_LINE.color);
  for (const l of zoneLines(page)) {
    out.drawLine({
      start: { x: X(l.x1), y: Y(l.y1) },
      end: { x: X(l.x2), y: Y(l.y2) },
      thickness: ZONE_LINE.width * PX_TO_PT,
      color: zc.color,
    });
  }

  // רקע: אותם קווים כמו על המסך
  const pattern = generatePattern(page, area, 1);
  const colors = patternColors(page.background.color);
  for (const l of pattern.lines) {
    const c = parseColor(colors[l.kind]);
    out.drawLine({
      start: { x: X(l.x1), y: Y(l.y1) },
      end: { x: X(l.x2), y: Y(l.y2) },
      thickness: LINE_WIDTH_PX[l.kind] * PX_TO_PT,
      color: c.color,
      opacity: c.opacity,
    });
  }
  if (pattern.labels.length > 0) {
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const size = Math.min(14, Math.max(9, page.background.spacing * 0.38)) * k;
    const c = parseColor(colors.label);
    for (const lb of pattern.labels) {
      const w = font.widthOfTextAtSize(lb.text, size);
      const dx = lb.align === 'center' ? -w / 2 : lb.align === 'right' ? -w : 0;
      out.drawText(lb.text, {
        x: X(lb.x) + dx,
        y: Y(lb.y) - size * 0.35,
        size,
        font,
        color: c.color,
        opacity: c.opacity,
      });
    }
  }
  for (const a of pattern.arrows) {
    const s = 9;
    const path = `M${a.x} ${a.y}L${a.x - a.dx * s - a.dy * s * 0.5} ${a.y - a.dy * s + a.dx * s * 0.5}L${a.x - a.dx * s + a.dy * s * 0.5} ${a.y - a.dy * s - a.dx * s * 0.5}Z`;
    const c = parseColor(colors.axis);
    out.drawSvgPath(path, {
      x: X(0),
      y: Y(0),
      scale: k,
      color: c.color,
      opacity: c.opacity,
      borderWidth: 0,
    });
  }

  // האובייקטים – לפי סדר השכבות
  for (const o of visibleObjects(page)) {
    const t = o.transform;
    const base = {
      x: X(t.x),
      y: Y(t.y),
      scale: k * t.scale,
      rotate: degrees(-t.rotation),
      borderWidth: 0,
    };
    if (o.type === 'ink') {
      const d = polygonToSvgPath(outlinePolygon(o.points, o.style.kind, o.style.width, o.pressure));
      if (!d) continue;
      out.drawSvgPath(d, {
        ...base,
        color: parseColor(o.style.color).color,
        opacity: o.style.opacity,
        blendMode: o.style.kind === 'highlighter' ? BlendMode.Multiply : BlendMode.Normal,
      });
    } else if (o.type === 'shape') {
      drawPdfShape(out, o, base);
    } else {
      // טקסט, נוסחה, גרף וטבלה – כתמונה חדה (פי 4)
      await drawPdfRaster(pdf, out, o, X, Y, k);
    }
  }
}

type PdfBase = {
  x: number;
  y: number;
  scale: number;
  rotate: ReturnType<typeof degrees>;
  borderWidth: number;
};

/** קו/חץ כצורה וקטורית (קו עם סוג קו, וראשי חץ ממולאים). */
function drawPdfShape(out: PDFPage, o: ShapeObject, base: PdfBase) {
  const { dx, dy } = o;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const head = o.kind === 'arrow' ? Math.min(arrowHeadSize(o.style.width), len * 0.45) : 0;
  const startHead = o.kind === 'arrow' && o.arrowStart ? head : 0;
  const c = parseColor(o.style.color);
  const dash = dashPattern(o.style.dash, o.style.width);
  out.drawSvgPath(
    `M${ux * startHead * 0.8} ${uy * startHead * 0.8}L${dx - ux * head * 0.8} ${dy - uy * head * 0.8}`,
    {
      ...base,
      borderColor: c.color,
      borderOpacity: o.style.opacity,
      borderWidth: o.style.width,
      borderLineCap: LineCapStyle.Round,
      borderDashArray: dash.length ? dash : undefined,
    },
  );
  const tip = (x: number, y: number, dirX: number, dirY: number) => {
    const bx = x - dirX * head;
    const by = y - dirY * head;
    const w = head * 0.55;
    out.drawSvgPath(
      `M${x} ${y}L${bx - dirY * w} ${by + dirX * w}L${bx + dirY * w} ${by - dirX * w}Z`,
      {
        ...base,
        color: c.color,
        opacity: o.style.opacity,
      },
    );
  };
  if (head > 0) tip(dx, dy, ux, uy);
  if (startHead > 0) tip(0, 0, -ux, -uy);
}

/**
 * טקסט ב-PDF: נשמר כתמונה ברזולוציה גבוהה (פי 4), כי ספריית ה-PDF לא יודעת לסדר
 * עברית מימין לשמאל. כך הטקסט נראה בדיוק כמו על המסך.
 */
async function drawPdfRaster(
  pdf: PDFDocument,
  out: PDFPage,
  o: TextObject | MathObject | GraphObject | TableObject | GeometryObject,
  X: (x: number) => number,
  Y: (y: number) => number,
  k: number,
) {
  const b = localBounds(o);
  const res = 4 * o.transform.scale;
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(b.width * res));
  c.height = Math.max(1, Math.ceil(b.height * res));
  const ctx = c.getContext('2d');
  if (!ctx) return;
  ctx.scale(res, res);
  ctx.translate(-b.x, -b.y);
  drawObjectLocal(ctx, o);
  const img = await pdf.embedPng(new Uint8Array(await (await canvasToBlob(c)).arrayBuffer()));
  // פינת התמונה (המקומית b.x, b.y+height) אחרי סיבוב וקנה מידה
  const t = o.transform;
  const rad = (t.rotation * Math.PI) / 180;
  const lx = b.x;
  const ly = b.y + b.height;
  const wx = t.x + (lx * Math.cos(rad) - ly * Math.sin(rad)) * t.scale;
  const wy = t.y + (lx * Math.sin(rad) + ly * Math.cos(rad)) * t.scale;
  out.drawImage(img, {
    x: X(wx),
    y: Y(wy),
    width: b.width * t.scale * k,
    height: b.height * t.scale * k,
    rotate: degrees(-t.rotation),
  });
}

/** יוצר PDF מהעמודים שנבחרו. */
export async function exportPdf(
  doc: BoardDocument,
  pageIds: string[],
  title: string,
  assets: PdfAssets,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(title);
  pdf.setCreator('TeachBoard');
  pdf.setProducer('TeachBoard');
  const cache: ExportCache = { images: new Map(), pdfDocs: new Map(), pdfPages: new Map() };
  for (const id of pageIds) {
    const page = doc.pages.find((p) => p.id === id);
    if (page) await addPage(pdf, page, assets, cache);
  }
  return pdf.save();
}

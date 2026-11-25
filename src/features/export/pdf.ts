import { BlendMode, PDFDocument, rgb, StandardFonts, type PDFImage, type PDFPage } from 'pdf-lib';
import { generatePattern, LINE_WIDTH_PX, patternColors } from '../../core/background/pattern';
import type { BoardDocument, Page } from '../../core/document/types';
import { outlinePolygon, polygonToSvgPath } from '../../engine/render/inkOutline';
import { exportArea } from './renderPage';

// ייצוא PDF וקטורי: קווי כתב היד והרקע נשמרים כצורות (חדים בכל הגדלה ובהדפסה).

/** פיקסל (96 לאינץ') → נקודת PDF (72 לאינץ') */
const PX_TO_PT = 0.75;
/** גודל עמוד מקסימלי שמותר ב-PDF (בנקודות) */
const MAX_PT = 14000;

export interface PdfAssets {
  /** בתים של תמונת רקע לפי מזהה, כבר כ-PNG או JPEG */
  get(assetId: string): Promise<{ type: 'image/png' | 'image/jpeg'; data: Uint8Array } | null>;
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

async function addPage(
  pdf: PDFDocument,
  page: Page,
  assets: PdfAssets,
  imageCache: Map<string, PDFImage>,
) {
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

  // כתב היד – כצורות וקטוריות
  for (const o of page.objects) {
    const d = polygonToSvgPath(outlinePolygon(o.points, o.style.kind, o.style.width, o.pressure));
    if (!d) continue;
    const c = parseColor(o.style.color);
    out.drawSvgPath(d, {
      x: X(o.transform.x),
      y: Y(o.transform.y),
      scale: k,
      color: c.color,
      opacity: o.style.opacity,
      borderWidth: 0,
      blendMode: o.style.kind === 'highlighter' ? BlendMode.Multiply : BlendMode.Normal,
    });
  }
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
  const cache = new Map<string, PDFImage>();
  for (const id of pageIds) {
    const page = doc.pages.find((p) => p.id === id);
    if (page) await addPage(pdf, page, assets, cache);
  }
  return pdf.save();
}

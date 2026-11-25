import type { Rect } from '../../core/geometry/rect';
import { unionRects } from '../../core/geometry/rect';
import type { Page } from '../../core/document/types';
import { objectBounds } from '../../core/objects/geometry';
import { drawPageBackground, type ImageSource } from '../../engine/render/BackgroundLayer';
import { drawObjectWorld } from '../../engine/render/drawObject';
import { ensureMathImages } from '../../engine/render/mathCache';

// ציור עמוד שלם על משטח נפרד – לתמונות ממוזערות ולייצוא תמונה.

/** האזור שמייצאים: עמוד מחברת – הדף; לוח אינסופי – התוכן עם שוליים. */
export function exportArea(page: Page, margin = 40): Rect {
  if (page.layout === 'bounded') return { x: 0, y: 0, ...page.size };
  const content = unionRects(page.objects.map(objectBounds));
  if (!content) return { x: 0, y: 0, ...page.size };
  return {
    x: content.x - margin,
    y: content.y - margin,
    width: content.width + margin * 2,
    height: content.height + margin * 2,
  };
}

/** מחכה שכל הנוסחאות בעמודים יהיו מוכנות לציור (לפני ייצוא/תמונה ממוזערת) */
export async function prepareMath(pages: readonly Page[]): Promise<void> {
  const items = pages.flatMap((p) =>
    p.objects.filter((o) => o.type === 'math').map((o) => ({ latex: o.latex, color: o.color })),
  );
  if (items.length) await ensureMathImages(items);
}

export function drawObjects(ctx: CanvasRenderingContext2D, page: Page): void {
  for (const o of page.objects) drawObjectWorld(ctx, o);
}

/** מצייר את העמוד על canvas חדש. scale = פיקסלים ליחידת לוח. */
export function renderPageToCanvas(
  page: Page,
  scale: number,
  images: ImageSource | null,
): HTMLCanvasElement {
  const area = exportArea(page);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(area.width * scale));
  canvas.height = Math.max(1, Math.round(area.height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is not available');
  ctx.setTransform(scale, 0, 0, scale, -area.x * scale, -area.y * scale);
  drawPageBackground(ctx, page, area, scale, images, { shadow: false });
  drawObjects(ctx, page);
  return canvas;
}

export async function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/png'): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Export failed'))), type, 0.92),
  );
}

/** תמונה ממוזערת קטנה (data URL) של העמוד הראשון. */
export function thumbnailDataUrl(page: Page, images: ImageSource | null, maxWidth = 240): string {
  const area = exportArea(page);
  const scale = Math.min(maxWidth / area.width, 1);
  return renderPageToCanvas(page, scale, images).toDataURL('image/jpeg', 0.7);
}

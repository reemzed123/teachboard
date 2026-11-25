import Konva from 'konva';
import { generatePattern, LINE_WIDTH_PX, patternColors } from '../../core/background/pattern';
import type { Rect } from '../../core/geometry/rect';
import type { Page } from '../../core/document/types';

/** מקור לתמונות רקע (נטענות מאחסון השיעור). */
export interface ImageSource {
  getImage(assetId: string): CanvasImageSource | null;
  /** הודעה כשתמונה סיימה להיטען (כדי לצייר מחדש) */
  onChange?(listener: () => void): () => void;
}

/**
 * מצייר את רקע העמוד: הדף (בעמוד מחברת – עם צל), צבע, תמונה ותבנית קווים.
 * מציירים רק את מה שנראה במסך, כדי שגם לוח אינסופי יהיה מהיר.
 */
export class BackgroundLayer {
  readonly layer = new Konva.Layer({ listening: false });
  private page: Page | null = null;
  private visible: Rect = { x: 0, y: 0, width: 0, height: 0 };
  private scale = 1;

  constructor(private images: ImageSource | null) {
    this.layer.add(
      new Konva.Shape({
        listening: false,
        perfectDrawEnabled: false,
        sceneFunc: (kctx) => this.draw(kctx._context),
      }),
    );
  }

  update(page: Page, visible: Rect, scale: number): void {
    this.page = page;
    this.visible = visible;
    this.scale = scale;
  }

  private draw(ctx: CanvasRenderingContext2D): void {
    const page = this.page;
    if (!page) return;
    drawPageBackground(ctx, page, this.visible, this.scale, this.images);
  }
}

/** ציור רקע עמוד על הקשר ציור שכבר ממוקם בקואורדינטות לוח (משמש גם לייצוא תמונה). */
export function drawPageBackground(
  ctx: CanvasRenderingContext2D,
  page: Page,
  visible: Rect,
  scale: number,
  images: ImageSource | null,
  options: { shadow?: boolean } = { shadow: true },
): void {
  const bg = page.background;
  const area: Rect = page.layout === 'bounded' ? { x: 0, y: 0, ...page.size } : visible;

  ctx.save();
  if (page.layout === 'bounded' && options.shadow) {
    ctx.shadowColor = 'rgba(16,24,40,0.18)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 4 / scale;
  }
  ctx.fillStyle = bg.color;
  ctx.fillRect(area.x, area.y, area.width, area.height);
  ctx.restore();

  if (bg.imageAssetId && images) {
    const img = images.getImage(bg.imageAssetId);
    if (img) ctx.drawImage(img, 0, 0, page.size.width, page.size.height);
  }

  const pattern = generatePattern(page, visible, scale);
  if (pattern.lines.length === 0 && pattern.labels.length === 0) return;
  const colors = patternColors(bg.color);

  ctx.save();
  ctx.lineCap = 'butt';
  for (const kind of ['minor', 'major', 'margin', 'axis'] as const) {
    const lines = pattern.lines.filter((l) => l.kind === kind);
    if (lines.length === 0) continue;
    ctx.beginPath();
    for (const l of lines) {
      ctx.moveTo(l.x1, l.y1);
      ctx.lineTo(l.x2, l.y2);
    }
    ctx.strokeStyle = colors[kind];
    ctx.lineWidth = LINE_WIDTH_PX[kind] / scale;
    ctx.stroke();
  }

  if (pattern.arrows.length > 0) {
    const size = 9 / scale;
    ctx.fillStyle = colors.axis;
    for (const a of pattern.arrows) {
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(a.x - a.dx * size - a.dy * size * 0.5, a.y - a.dy * size + a.dx * size * 0.5);
      ctx.lineTo(a.x - a.dx * size + a.dy * size * 0.5, a.y - a.dy * size - a.dx * size * 0.5);
      ctx.closePath();
      ctx.fill();
    }
  }

  if (pattern.labels.length > 0) {
    const fontPx = Math.min(14, Math.max(9, page.background.spacing * 0.38));
    ctx.fillStyle = colors.label;
    ctx.font = `${fontPx}px "Heebo Variable", "Segoe UI", Arial, sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.direction = 'ltr';
    for (const l of pattern.labels) {
      ctx.textAlign = l.align;
      ctx.fillText(l.text, l.x, l.y);
    }
  }
  ctx.restore();
}

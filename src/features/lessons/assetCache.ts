import type { LessonRepository } from '../../platform/types';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { Page } from '../../core/document/types';
import type { ImageSource } from '../../engine/render/BackgroundLayer';
import { openPdf, pageSizes, renderPdfPage } from '../pdf/pdfjs';

/** סוגי תמונות שמותר להעלות כרקע (SVG לא מותר – הוא יכול להכיל קוד). */
export const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

/** בודק לפי "חתימת" הקובץ (הבתים הראשונים) שזו באמת תמונה מסוג מותר. */
export function sniffImageType(bytes: Uint8Array): (typeof IMAGE_TYPES)[number] | null {
  const b = bytes;
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (
    b[0] === 0x52 &&
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x46 &&
    b[8] === 0x57 &&
    b[9] === 0x45 &&
    b[10] === 0x42 &&
    b[11] === 0x50
  )
    return 'image/webp';
  return null;
}

export const MAX_PDF_BYTES = 100 * 1024 * 1024;

export function isPdf(bytes: Uint8Array): boolean {
  return (
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  );
}

/** רמות החדות של עמוד PDF (פיקסלים ליחידת לוח) */
const PDF_LEVELS = [1, 2, 3, 4.5, 6];
/** גבול פיקסלים לתמונת עמוד אחת (זיכרון ומגבלת דפדפן) */
const MAX_PDF_PIXELS = 24_000_000;
/** כמה עמודים מצוירים שומרים בזיכרון */
const MAX_PDF_RENDERS = 16;

/** הרמה המתאימה לחדות המבוקשת, בלי לחרוג ממגבלת הפיקסלים */
export function pdfLevel(want: number, size: { width: number; height: number }): number {
  const cap = Math.sqrt(MAX_PDF_PIXELS / Math.max(1, size.width * size.height));
  const level = PDF_LEVELS.find((l) => l >= want * 0.95) ?? PDF_LEVELS[PDF_LEVELS.length - 1]!;
  return Math.max(0.5, Math.min(level, cap));
}

export async function sha256Hex(data: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * מטמון תמונות רקע: מחזיר תמונה אם כבר נטענה, ואחרת מתחיל לטעון אותה
 * ומודיע כשהיא מוכנה (כדי לצייר מחדש).
 */
export class AssetCache implements ImageSource {
  private images = new Map<string, ImageBitmap | null>();
  private listeners = new Set<() => void>();
  private pdfDocs = new Map<string, Promise<PDFDocumentProxy | null>>();
  /** עמודי PDF מצוירים: מפתח "asset:page" → התמונה וקנה המידה שלה */
  private pdfRenders = new Map<string, { scale: number; image: ImageBitmap }>();
  private pdfPending = new Map<string, number>();
  /** ציור אחד בכל פעם – כדי לא להעמיס */
  private pdfQueue: Promise<unknown> = Promise.resolve();

  constructor(private repo: LessonRepository) {}

  getImage(assetId: string): CanvasImageSource | null {
    if (this.images.has(assetId)) return this.images.get(assetId) ?? null;
    this.images.set(assetId, null);
    void this.load(assetId);
    return null;
  }

  /** טוען מראש (למשל לפני ייצוא) */
  async ensure(assetIds: string[]): Promise<void> {
    await Promise.all(assetIds.filter((id) => !this.images.get(id)).map((id) => this.load(id)));
  }

  private async load(assetId: string) {
    try {
      const asset = await this.repo.getAsset(assetId);
      if (!asset) return;
      if (asset.type === 'application/pdf') return;
      this.images.set(assetId, await createImageBitmap(asset.blob));
      this.notify();
    } catch {
      // תמונה פגומה – פשוט לא מוצגת
    }
  }

  private pdfDoc(assetId: string): Promise<PDFDocumentProxy | null> {
    let p = this.pdfDocs.get(assetId);
    if (!p) {
      p = (async () => {
        const asset = await this.repo.getAsset(assetId);
        if (!asset) return null;
        return openPdf(new Uint8Array(await asset.blob.arrayBuffer())).catch(() => null);
      })();
      this.pdfDocs.set(assetId, p);
    }
    return p;
  }

  getPdfPage(
    assetId: string,
    page: number,
    pixelScale: number,
    size: { width: number; height: number },
  ): CanvasImageSource | null {
    const key = `${assetId}:${page}`;
    const level = pdfLevel(pixelScale, size);
    const have = this.pdfRenders.get(key);
    if (have) {
      // רענון סדר ה-LRU
      this.pdfRenders.delete(key);
      this.pdfRenders.set(key, have);
    }
    if ((!have || have.scale < level) && (this.pdfPending.get(key) ?? 0) < level) {
      void this.renderPdf(assetId, page, level).then(() => this.notify());
    }
    return have?.image ?? null;
  }

  /** מצייר מראש עמוד PDF (למשל לפני ייצוא תמונה) */
  async ensurePdfPage(
    assetId: string,
    page: number,
    pixelScale: number,
    size: { width: number; height: number },
  ): Promise<void> {
    const level = pdfLevel(pixelScale, size);
    const have = this.pdfRenders.get(`${assetId}:${page}`);
    if (!have || have.scale < level) await this.renderPdf(assetId, page, level);
  }

  private renderPdf(assetId: string, page: number, level: number): Promise<void> {
    const key = `${assetId}:${page}`;
    this.pdfPending.set(key, level);
    const job = this.pdfQueue.then(async () => {
      try {
        const have = this.pdfRenders.get(key);
        if (have && have.scale >= level) return;
        const doc = await this.pdfDoc(assetId);
        if (!doc || page >= doc.numPages) return;
        const image = await renderPdfPage(doc, page, level);
        have?.image.close();
        this.pdfRenders.delete(key);
        this.pdfRenders.set(key, { scale: level, image });
        while (this.pdfRenders.size > MAX_PDF_RENDERS) {
          const [oldKey, old] = this.pdfRenders.entries().next().value!;
          old.image.close();
          this.pdfRenders.delete(oldKey);
        }
      } catch {
        // עמוד שלא ניתן לצייר – נשאר דף לבן
      } finally {
        if (this.pdfPending.get(key) === level) this.pdfPending.delete(key);
      }
    });
    this.pdfQueue = job;
    return job;
  }

  /** מכין את כל הרקעים של העמודים (תמונות ועמודי PDF) – לפני ייצוא או תמונה ממוזערת */
  async preparePages(pages: readonly Page[], pixelScale: number): Promise<void> {
    const images = pages.flatMap((p) => [
      ...(p.background.imageAssetId ? [p.background.imageAssetId] : []),
      ...p.objects.flatMap((o) => (o.type === 'image' ? [o.assetId] : [])),
    ]);
    await this.ensure([...new Set(images)]);
    for (const p of pages) {
      const pdf = p.background.pdf;
      if (pdf) await this.ensurePdfPage(pdf.assetId, pdf.page, pixelScale, p.size);
    }
  }

  /** גודל התמונה (פיקסלים), אחרי שנטענה */
  imageSize(assetId: string): { width: number; height: number } | null {
    const img = this.images.get(assetId);
    return img ? { width: img.width, height: img.height } : null;
  }

  /** בתים של PDF מקורי (לייצוא) */
  async pdfBytes(assetId: string): Promise<Uint8Array | null> {
    const asset = await this.repo.getAsset(assetId);
    return asset && asset.type === 'application/pdf'
      ? new Uint8Array(await asset.blob.arrayBuffer())
      : null;
  }

  /**
   * מוסיף קובץ PDF (נשמר כמו שהוא – המקור לא משתנה).
   * מחזיר את המזהה ואת גדלי העמודים, או זורק שגיאה מוסברת.
   */
  async addPdf(file: Blob): Promise<{ id: string; sizes: { width: number; height: number }[] }> {
    if (file.size > MAX_PDF_BYTES) throw new Error('pdfTooLarge');
    const data = new Uint8Array(await file.arrayBuffer());
    if (!isPdf(data)) throw new Error('pdfType');
    const doc = await openPdf(data).catch((err: Error) => {
      throw new Error(err.message === 'password' ? 'pdfPassword' : 'pdfType');
    });
    const sizes = await pageSizes(doc);
    if (sizes.length === 0) throw new Error('pdfType');
    const id = await sha256Hex(data.buffer as ArrayBuffer);
    await this.repo.putAsset({
      id,
      type: 'application/pdf',
      blob: new Blob([data], { type: 'application/pdf' }),
    });
    this.pdfDocs.set(id, Promise.resolve(doc));
    return { id, sizes };
  }

  private notify() {
    for (const l of this.listeners) l();
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** מוסיף תמונה מקובץ שהמשתמש בחר. מחזיר את המזהה, או זורק שגיאה מוסברת. */
  async addFromFile(file: Blob): Promise<string> {
    if (file.size > MAX_IMAGE_BYTES) throw new Error('imageTooLarge');
    const data = await file.arrayBuffer();
    const type = sniffImageType(new Uint8Array(data.slice(0, 16)));
    if (!type) throw new Error('imageType');
    const blob = new Blob([data], { type });
    // מוודאים שהדפדפן מצליח לפענח אותה לפני שמירה
    const bitmap = await createImageBitmap(blob).catch(() => null);
    if (!bitmap) throw new Error('imageType');
    const id = await sha256Hex(data);
    await this.repo.putAsset({ id, type, blob });
    this.images.set(id, bitmap);
    return id;
  }
}

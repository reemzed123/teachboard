import type { LessonRepository } from '../../platform/types';
import type { ImageSource } from '../../engine/render/BackgroundLayer';

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
      this.images.set(assetId, await createImageBitmap(asset.blob));
      for (const l of this.listeners) l();
    } catch {
      // תמונה פגומה – פשוט לא מוצגת
    }
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

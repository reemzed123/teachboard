import type { AppRuntime } from '../../app/runtime';
import { newId } from '../../core/document/ids';
import type { ImageObject } from '../../core/document/types';
import { t } from '../../i18n';
import { pickFile } from '../../platform/web/files';
import { IMAGE_TYPES } from './assetCache';
import { importPdf, openBoardFile } from './fileActions';

// הוספת תמונות ללוח: הדבקה (Ctrl+V), גרירת קובץ, או בחירת קובץ.

/** גודל מקסימלי לתמונה חדשה על הלוח (יחידות לוח, לפני הגדלה ידנית) */
const MAX_SIDE = 560;

function imageErrorMessage(err: unknown): string {
  const m = (err as Error | null)?.message;
  if (m === 'imageTooLarge') return t('image.error.tooLarge');
  if (m === 'imageType') return t('image.error.type');
  return t('files.error.read');
}

/**
 * מוסיף תמונה כאובייקט. at = מרכז התמונה בקואורדינטות לוח (ברירת מחדל: מרכז המסך).
 * הקובץ נבדק (סוג אמיתי, גודל) ונשמר בשיעור כמו שהוא.
 */
export async function addImageFile(
  rt: AppRuntime,
  file: Blob,
  at?: { x: number; y: number },
): Promise<boolean> {
  try {
    const assetId = await rt.assets.addFromFile(file);
    const size = rt.assets.imageSize(assetId) ?? { width: 400, height: 300 };
    const k = Math.min(1, MAX_SIDE / Math.max(size.width, size.height));
    const width = Math.round(size.width * k);
    const height = Math.round(size.height * k);
    const s = rt.board.getState();
    const center = at ?? viewCenter(rt);
    const obj: ImageObject = {
      id: newId(),
      type: 'image',
      transform: { x: center.x - width / 2, y: center.y - height / 2, rotation: 0, scale: 1 },
      assetId,
      width,
      height,
    };
    s.commit('image', [{ type: 'add', pageId: s.pageId, objects: [obj] }]);
    s.setTool('select');
    s.setSelection([obj.id]);
    return true;
  } catch (err) {
    rt.app.getState().notify('error', imageErrorMessage(err));
    return false;
  }
}

/** מרכז האזור הנראה בלוח (קואורדינטות לוח) */
function viewCenter(rt: AppRuntime): { x: number; y: number } {
  const v = rt.board.getState().view;
  const host = document.querySelector('[data-testid=board]');
  const w = host?.clientWidth ?? 800;
  const h = host?.clientHeight ?? 600;
  return { x: (w / 2 - v.x) / v.scale, y: (h / 2 - v.y) / v.scale };
}

export async function pickAndAddImage(rt: AppRuntime): Promise<void> {
  const f = await pickFile(IMAGE_TYPES.join(','));
  if (f) await addImageFile(rt, f);
}

/** תמונה מתוך נתוני הדבקה/גרירה (אם יש) */
export function imageFrom(data: DataTransfer | null): File | null {
  if (!data) return null;
  for (const item of Array.from(data.items ?? [])) {
    if (item.kind === 'file' && item.type.startsWith('image/')) return item.getAsFile();
  }
  for (const f of Array.from(data.files ?? [])) if (f.type.startsWith('image/')) return f;
  return null;
}

/** קובץ שנגרר ללוח: תמונה – נוספת במקום השחרור; PDF – נוסף לשיעור; ‎.board – נפתח */
export async function handleDroppedFiles(
  rt: AppRuntime,
  files: File[],
  at: { x: number; y: number },
): Promise<void> {
  for (const f of files) {
    if (f.type.startsWith('image/')) await addImageFile(rt, f, at);
    else if (/\.pdf$/i.test(f.name) || f.type === 'application/pdf')
      await importPdf(rt, 'append', f);
    else if (/\.board$/i.test(f.name)) await openBoardFile(rt, f);
  }
}

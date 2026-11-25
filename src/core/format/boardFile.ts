import { strFromU8, strToU8, unzipSync, zipSync, type Unzipped } from 'fflate';
import type { BoardDocument } from '../document/types';
import { FormatError, referencedAssets, validateDocument, type ValidationReport } from './validate';

// פורמט קובץ שיעור ‎.board – קובץ ZIP:
//   manifest.json   – זיהוי הפורמט וגרסתו
//   document.json   – השיעור (עמודים, אובייקטים, רקעים)
//   assets/<sha256> – תמונות רקע (PNG/JPEG/WebP בלבד)
// מפרט מלא: docs/board-format.md

export const BOARD_FORMAT_ID = 'teachboard';
export const BOARD_FORMAT_VERSION = 1;
export const BOARD_MIME = 'application/x-teachboard';
export const BOARD_EXTENSION = '.board';

/** מגבלות קריאה – מגינות מפני קבצים זדוניים ("פצצת ZIP") */
export const FILE_LIMITS = {
  fileBytes: 300 * 1024 * 1024,
  totalUnzippedBytes: 600 * 1024 * 1024,
  documentBytes: 200 * 1024 * 1024,
  entries: 2000,
  assetBytes: 20 * 1024 * 1024,
} as const;

export interface BoardAsset {
  id: string;
  type: string;
  data: Uint8Array;
}

export interface BoardFileContent {
  title: string;
  doc: BoardDocument;
  assets: BoardAsset[];
}

interface Manifest {
  format: string;
  formatVersion: number;
  title: string;
  createdWith: string;
  savedAt: string;
}

const ASSET_PATH = /^assets\/([a-f0-9]{64})$/;
const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

function sniff(b: Uint8Array): string | null {
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (
    b[0] === 0x52 &&
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x46 &&
    b[8] === 0x57 &&
    b[9] === 0x45
  )
    return 'image/webp';
  return null;
}

/** אורז שיעור לקובץ ‎.board */
export function packBoardFile(content: BoardFileContent, appVersion: string): Uint8Array {
  const manifest: Manifest = {
    format: BOARD_FORMAT_ID,
    formatVersion: BOARD_FORMAT_VERSION,
    title: content.title,
    createdWith: `TeachBoard ${appVersion}`,
    savedAt: new Date().toISOString(),
  };
  const used = new Set(referencedAssets(content.doc));
  const files: Record<string, Uint8Array> = {
    'manifest.json': strToU8(JSON.stringify(manifest, null, 2)),
    'document.json': strToU8(JSON.stringify(content.doc)),
  };
  for (const a of content.assets) {
    if (used.has(a.id) && ALLOWED_TYPES.has(a.type)) files[`assets/${a.id}`] = a.data;
  }
  // JSON נדחס היטב; תמונות כבר דחוסות – לא דוחסים שוב.
  return zipSync(
    Object.fromEntries(
      Object.entries(files).map(([k, v]) => [k, [v, { level: k.endsWith('.json') ? 6 : 0 }]]),
    ),
  );
}

/**
 * קורא קובץ ‎.board. זורק FormatError עם קוד ברור אם הקובץ לא תקין.
 * לא מריץ שום קוד מתוך הקובץ – רק קורא נתונים ובודק אותם.
 */
export function unpackBoardFile(bytes: Uint8Array, report?: ValidationReport): BoardFileContent {
  if (bytes.length > FILE_LIMITS.fileBytes) throw new FormatError('tooLarge', 'file');
  if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
    throw new FormatError('notDocument', 'not a zip');
  }

  let entries = 0;
  let total = 0;
  let files: Unzipped;
  try {
    files = unzipSync(bytes, {
      // בודקים כל קובץ לפני פריסה: שם מוכר וגודל סביר.
      filter(file) {
        entries++;
        if (entries > FILE_LIMITS.entries) throw new FormatError('tooLarge', 'entries');
        const known =
          file.name === 'manifest.json' ||
          file.name === 'document.json' ||
          ASSET_PATH.test(file.name);
        if (!known) return false;
        const limit = file.name.startsWith('assets/')
          ? FILE_LIMITS.assetBytes
          : FILE_LIMITS.documentBytes;
        if (file.originalSize > limit) throw new FormatError('tooLarge', file.name);
        total += file.originalSize;
        if (total > FILE_LIMITS.totalUnzippedBytes) throw new FormatError('tooLarge', 'total');
        return true;
      },
    });
  } catch (err) {
    if (err instanceof FormatError) throw err;
    throw new FormatError('notDocument', 'corrupt zip');
  }

  const parse = (name: string): unknown => {
    const f = files[name];
    if (!f) throw new FormatError('notDocument', `missing ${name}`);
    try {
      return JSON.parse(strFromU8(f));
    } catch {
      throw new FormatError('invalid', `bad json ${name}`);
    }
  };

  const manifest = parse('manifest.json') as Partial<Manifest> | null;
  if (!manifest || typeof manifest !== 'object' || manifest.format !== BOARD_FORMAT_ID) {
    throw new FormatError('notDocument', 'manifest');
  }
  if (typeof manifest.formatVersion !== 'number' || manifest.formatVersion > BOARD_FORMAT_VERSION) {
    throw new FormatError('newerVersion', String(manifest.formatVersion));
  }

  const doc = validateDocument(parse('document.json'), report);
  const assets: BoardAsset[] = [];
  for (const id of referencedAssets(doc)) {
    const data = files[`assets/${id}`];
    const type = data ? sniff(data) : null;
    if (data && type) assets.push({ id, type, data });
    else {
      // תמונה חסרה/פגומה: מסירים את ההפניה, כדי שהעמוד ייפתח בלי התמונה
      for (const p of doc.pages)
        if (p.background.imageAssetId === id) delete p.background.imageAssetId;
    }
  }

  const title =
    typeof manifest.title === 'string' && manifest.title.trim()
      ? manifest.title.trim().slice(0, 200)
      : '';
  return { title, doc, assets };
}

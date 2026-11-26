import type { PDFDocumentProxy } from 'pdfjs-dist';

// טעינת מציג ה-PDF (PDF.js) – רק כשצריך (פתיחת PDF או שיעור עם עמודי PDF).
// כל קובצי העזר מקומיים (public/pdfjs) – עובד בלי אינטרנט.
// אבטחה: לא מופעלים סקריפטים/טפסים מתוך הקובץ (רק ציור התוכן).

type PdfJs = typeof import('pdfjs-dist');

let lib: Promise<PdfJs> | null = null;

export function loadPdfJs(): Promise<PdfJs> {
  lib ??= (async () => {
    const [mod, worker] = await Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
    ]);
    mod.GlobalWorkerOptions.workerSrc = worker.default;
    return mod;
  })();
  return lib;
}

const local = (path: string) => new URL(`pdfjs/${path}/`, document.baseURI).href;

export type PdfOpenError = 'password' | 'invalid';

/** פותח PDF מבתים. זורק Error עם message 'password' או 'invalid'. */
export async function openPdf(data: Uint8Array): Promise<PDFDocumentProxy> {
  const pdfjs = await loadPdfJs();
  try {
    // עותק: PDF.js מעביר את הבתים ל-worker, והמקור נשאר בלי שינוי
    return await pdfjs.getDocument({
      data: data.slice(),
      cMapUrl: local('cmaps'),
      cMapPacked: true,
      standardFontDataUrl: local('standard_fonts'),
      wasmUrl: local('wasm'),
      iccUrl: local('iccs'),
      enableXfa: false,
      useSystemFonts: false,
      disableRange: true,
      disableStream: true,
      disableAutoFetch: true,
      verbosity: 0,
    }).promise;
  } catch (err) {
    const name = (err as { name?: string } | null)?.name;
    throw new Error(name === 'PasswordException' ? 'password' : 'invalid', { cause: err });
  }
}

/** PDF נקודות (72 לאינץ') → יחידות לוח (96 לאינץ') */
export const PT_TO_PX = 96 / 72;

/** גדלי העמודים ביחידות לוח (כולל סיבוב העמוד) */
export async function pageSizes(
  doc: PDFDocumentProxy,
): Promise<{ width: number; height: number }[]> {
  const out: { width: number; height: number }[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const vp = page.getViewport({ scale: PT_TO_PX });
    out.push({ width: Math.round(vp.width), height: Math.round(vp.height) });
    page.cleanup();
  }
  return out;
}

/** מצייר עמוד (0 = הראשון) לתמונה בקנה מידה נתון (1 = יחידת לוח לפיקסל) */
export async function renderPdfPage(
  doc: PDFDocumentProxy,
  pageIndex: number,
  scale: number,
): Promise<ImageBitmap> {
  const page = await doc.getPage(pageIndex + 1);
  try {
    const vp = page.getViewport({ scale: PT_TO_PX * scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(vp.width));
    canvas.height = Math.max(1, Math.round(vp.height));
    // רקע לבן (כמו נייר), גם לקבצים עם רקע שקוף
    await page.render({ canvas, viewport: vp, background: '#ffffff' }).promise;
    const bmp = await createImageBitmap(canvas);
    canvas.width = canvas.height = 0;
    return bmp;
  } finally {
    page.cleanup();
  }
}

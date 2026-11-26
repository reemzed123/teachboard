import {
  BOARD_EXTENSION,
  BOARD_MIME,
  packBoardFile,
  unpackBoardFile,
  type BoardAsset,
} from '../../core/format/boardFile';
import { FormatError, referencedAssets } from '../../core/format/validate';
import type { AppRuntime } from '../../app/runtime';
import { t } from '../../i18n';
import { APP_VERSION } from '../../platform/desktop';
import { pickFile, saveFile } from '../../platform/web/files';
import { createPage, currentPage } from '../board/boardStore';
import type { BoardDocument, Page } from '../../core/document/types';
import { DOCUMENT_VERSION } from '../../core/document/types';
import { exportPdf } from '../export/pdf';
import { canvasToBlob, prepareMath, renderPageToCanvas } from '../export/renderPage';

// פעולות קבצים: שמירה/פתיחה של ‎.board, וייצוא תמונה ו-PDF.

async function collectAssets(rt: AppRuntime): Promise<BoardAsset[]> {
  const out: BoardAsset[] = [];
  for (const id of referencedAssets(rt.board.getState().doc)) {
    const a = await rt.repo.getAsset(id);
    if (a) out.push({ id, type: a.type, data: new Uint8Array(await a.blob.arrayBuffer()) });
  }
  return out;
}

export async function saveBoardFile(rt: AppRuntime): Promise<void> {
  await rt.lessons.getState().flush();
  const title = rt.lessons.getState().title;
  const bytes = packBoardFile(
    { title, doc: rt.board.getState().doc, assets: await collectAssets(rt) },
    APP_VERSION,
  );
  const saved = await saveFile(new Blob([bytes as BlobPart], { type: BOARD_MIME }), title, {
    description: t('files.boardFileType'),
    mime: BOARD_MIME,
    extension: BOARD_EXTENSION,
  });
  if (saved) rt.app.getState().notify('info', t('files.saved'));
}

export function formatErrorMessage(err: unknown): string {
  if (err instanceof FormatError) {
    switch (err.code) {
      case 'newerVersion':
        return t('files.error.newerVersion');
      case 'tooLarge':
        return t('files.error.tooLarge');
      default:
        return t('files.error.invalid');
    }
  }
  return t('files.error.read');
}

export async function openBoardFile(rt: AppRuntime, file?: File | null): Promise<void> {
  const f = file ?? (await pickFile(`${BOARD_EXTENSION},${BOARD_MIME}`));
  if (!f) return;
  try {
    const report = { skippedObjects: 0 };
    const content = unpackBoardFile(new Uint8Array(await f.arrayBuffer()), report);
    for (const a of content.assets) {
      await rt.repo.putAsset({
        id: a.id,
        type: a.type,
        blob: new Blob([a.data as BlobPart], { type: a.type }),
      });
    }
    const title = content.title || f.name.replace(/\.board$/i, '');
    await rt.lessons.getState().importLesson(content.doc, title);
    rt.app
      .getState()
      .notify(
        report.skippedObjects > 0 ? 'error' : 'info',
        report.skippedObjects > 0
          ? t('files.openedWithSkips', { n: report.skippedObjects })
          : t('files.opened', { title }),
      );
  } catch (err) {
    rt.app.getState().notify('error', formatErrorMessage(err));
  }
}

/** עמודי לוח מעמודי PDF: כל עמוד בגודל המקורי, וה-PDF ברקע */
function pdfPages(assetId: string, sizes: { width: number; height: number }[]): Page[] {
  return sizes.map((size, page) =>
    createPage({
      layout: 'bounded',
      size,
      background: { pattern: 'none', color: '#ffffff', spacing: 32, pdf: { assetId, page } },
    }),
  );
}

export const MAX_PDF_PAGES = 500;

function pdfErrorMessage(err: unknown): string {
  switch ((err as Error | null)?.message) {
    case 'pdfTooLarge':
      return t('files.error.pdfTooLarge');
    case 'pdfPassword':
      return t('files.error.pdfPassword');
    case 'pdfTooManyPages':
      return t('files.error.pdfTooManyPages', { n: MAX_PDF_PAGES });
    case 'pdfType':
      return t('files.error.pdfType');
    default:
      return t('files.error.read');
  }
}

/**
 * פתיחת PDF: כל עמוד הופך לעמוד בלוח שאפשר לכתוב עליו. הקובץ המקורי לא משתנה.
 * mode = 'new' – שיעור חדש בשם הקובץ; 'append' – אחרי העמוד הנוכחי בשיעור הפתוח.
 */
export async function importPdf(
  rt: AppRuntime,
  mode: 'new' | 'append',
  file?: File | null,
): Promise<void> {
  const f = file ?? (await pickFile('.pdf,application/pdf'));
  if (!f) return;
  rt.app.getState().notify('info', t('files.pdfLoading'));
  try {
    const { id, sizes } = await rt.assets.addPdf(f);
    if (sizes.length > MAX_PDF_PAGES) throw new Error('pdfTooManyPages');
    const pages = pdfPages(id, sizes);
    const title = f.name.replace(/\.pdf$/i, '') || t('files.pdfType');
    if (mode === 'new') {
      const doc: BoardDocument = { version: DOCUMENT_VERSION, pages };
      await rt.lessons.getState().importLesson(doc, title);
    } else {
      const s = rt.board.getState();
      const index = s.doc.pages.findIndex((p) => p.id === s.pageId) + 1;
      s.commit(
        'addPdf',
        pages.map((page, i) => ({ type: 'addPage' as const, page, index: index + i })),
      );
      s.goToPage(pages[0]!.id);
    }
    rt.app
      .getState()
      .notify(
        'info',
        pages.length === 1
          ? t('files.pdfOpenedOne', { title })
          : t('files.pdfOpened', { title, n: pages.length }),
      );
  } catch (err) {
    rt.app.getState().notify('error', pdfErrorMessage(err));
  }
}

function pageLabel(rt: AppRuntime): string {
  const s = rt.board.getState();
  const index = s.doc.pages.findIndex((p) => p.id === s.pageId);
  return t('files.pageSuffix', { n: index + 1 });
}

export async function exportPng(rt: AppRuntime): Promise<void> {
  const page = currentPage(rt.board.getState());
  await rt.assets.preparePages([page], 2);
  await prepareMath([page]);
  // פי 2 – חד גם בהקרנה ובהדפסה
  const blob = await canvasToBlob(renderPageToCanvas(page, 2, rt.assets));
  const title = `${rt.lessons.getState().title} - ${pageLabel(rt)}`;
  await saveFile(blob, title, {
    description: t('files.pngType'),
    mime: 'image/png',
    extension: '.png',
  });
}

/** ממיר תמונה (גם WebP) ל-PNG, כי PDF תומך רק ב-PNG/JPEG */
async function toPdfImage(
  blob: Blob,
  type: string,
): Promise<{ type: 'image/png' | 'image/jpeg'; data: Uint8Array }> {
  if (type === 'image/png' || type === 'image/jpeg') {
    return { type, data: new Uint8Array(await blob.arrayBuffer()) };
  }
  const bmp = await createImageBitmap(blob);
  const c = document.createElement('canvas');
  c.width = bmp.width;
  c.height = bmp.height;
  c.getContext('2d')!.drawImage(bmp, 0, 0);
  return { type: 'image/png', data: new Uint8Array(await (await canvasToBlob(c)).arrayBuffer()) };
}

export async function exportPdfFile(rt: AppRuntime, scope: 'page' | 'all'): Promise<void> {
  const s = rt.board.getState();
  const ids = scope === 'all' ? s.doc.pages.map((p) => p.id) : [s.pageId];
  const lessonTitle = rt.lessons.getState().title;
  await prepareMath(s.doc.pages.filter((p) => ids.includes(p.id)));
  const bytes = await exportPdf(s.doc, ids, lessonTitle, {
    get: async (id) => {
      const a = await rt.repo.getAsset(id);
      return a ? toPdfImage(a.blob, a.type) : null;
    },
    pdf: (id) => rt.assets.pdfBytes(id),
    pdfPageImage: async (page) => {
      // גיבוי: PDF שלא ניתן להטמיע (למשל מוצפן) – מצרפים תמונה חדה של העמוד
      await rt.assets.preparePages([page], 3);
      const blank = {
        ...page,
        background: { ...page.background, pattern: 'none' as const },
        objects: [],
      };
      const blob = await canvasToBlob(renderPageToCanvas(blank, 3, rt.assets));
      return new Uint8Array(await blob.arrayBuffer());
    },
  });
  const name = scope === 'all' ? lessonTitle : `${lessonTitle} - ${pageLabel(rt)}`;
  await saveFile(new Blob([bytes as BlobPart], { type: 'application/pdf' }), name, {
    description: t('files.pdfType'),
    mime: 'application/pdf',
    extension: '.pdf',
  });
}

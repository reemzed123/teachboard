import { useState } from 'react';
import { useBoard, useRuntime } from '../app/StoreContext';
import { currentPage } from '../features/board/boardStore';
import { exportPdfFile, importPdf } from '../features/lessons/fileActions';
import { pickAndAddImage } from '../features/lessons/imageActions';
import { t } from '../i18n';
import { SidePanel } from './SidePanel';

/** PDF ומסמכים: פתיחה, הוספה לשיעור וייצוא. */
export function PdfPanel() {
  const rt = useRuntime();
  const [busy, setBusy] = useState(false);
  const pdfPages = useBoard((s) => s.doc.pages.filter((p) => p.background.pdf).length);
  const onPdfPage = useBoard((s) => !!currentPage(s).background.pdf);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch {
      rt.app.getState().notify('error', t('files.error.export'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <SidePanel title={t('category.pdf')}>
      <div className="tb-button-column">
        <button
          type="button"
          className="tb-btn"
          disabled={busy}
          onClick={() => void run(() => importPdf(rt, 'new'))}
        >
          {t('files.openPdf')}
        </button>
        <button
          type="button"
          className="tb-btn"
          disabled={busy}
          onClick={() => void run(() => importPdf(rt, 'append'))}
        >
          {t('files.appendPdf')}
        </button>
      </div>
      <p className="tb-help">{t('files.pdfHelp')}</p>
      <section className="tb-field">
        <h3 className="tb-section-title">{t('image.add')}</h3>
        <button
          type="button"
          className="tb-btn"
          disabled={busy}
          data-action="image.add"
          onClick={() => void run(() => pickAndAddImage(rt))}
        >
          {t('image.add')}
        </button>
        <p className="tb-help">{t('image.help')}</p>
      </section>
      <p className="tb-help">{t('pdf.annotateHelp')}</p>
      {pdfPages > 0 && (
        <section className="tb-field">
          <h3 className="tb-section-title">{t('files.export')}</h3>
          <div className="tb-button-column">
            <button
              type="button"
              className="tb-btn"
              disabled={busy}
              onClick={() => void run(() => exportPdfFile(rt, 'page'))}
            >
              {t('files.exportPdfPage')}
            </button>
            <button
              type="button"
              className="tb-btn"
              disabled={busy}
              onClick={() => void run(() => exportPdfFile(rt, 'all'))}
            >
              {t('files.exportPdfAll')}
            </button>
          </div>
          <p className="tb-help">
            {onPdfPage
              ? t('pdf.onPdfPage', { n: pdfPages })
              : t('pdf.pagesInLesson', { n: pdfPages })}
          </p>
        </section>
      )}
    </SidePanel>
  );
}

import { useEffect, useState } from 'react';
import { useStore } from 'zustand';
import { useRuntime } from '../app/StoreContext';
import {
  exportPdfFile,
  exportPng,
  importPdf,
  openBoardFile,
  saveBoardFile,
} from '../features/lessons/fileActions';
import { t } from '../i18n';
import type { VersionMeta } from '../platform/types';
import { ConfirmDialog } from './ConfirmDialog';
import { LessonLibrary } from './LessonLibrary';
import { SidePanel } from './SidePanel';

const dateFmt = new Intl.DateTimeFormat('he-IL', { dateStyle: 'short', timeStyle: 'short' });

/** ניהול שיעורים וקבצים: שיעור חדש, פתיחה, שמירה כקובץ, ייצוא, גרסאות, ורשימת השיעורים. */
export function FilesPanel() {
  const rt = useRuntime();
  const currentId = useStore(rt.lessons, (s) => s.lessonId);
  const [busy, setBusy] = useState(false);
  // התיקייה שמוצגת (שיעור חדש נוצר בה)
  const [folderId, setFolderId] = useState<string | null>(null);

  useEffect(() => {
    void rt.lessons.getState().refreshList();
  }, [rt]);

  /** מריץ פעולה, ומציג הודעה ברורה אם נכשלה */
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
    <SidePanel title={t('category.files')}>
      <section className="tb-field" aria-label={t('files.current')}>
        <h3 className="tb-section-title">{t('files.current')}</h3>
        <div className="tb-button-column">
          <button
            type="button"
            className="tb-btn"
            disabled={busy}
            onClick={() => void run(() => rt.lessons.getState().newLesson(folderId))}
          >
            {t('files.new')}
          </button>
          <button
            type="button"
            className="tb-btn"
            disabled={busy}
            onClick={() => void run(() => saveBoardFile(rt))}
          >
            {t('files.saveBoard')}
          </button>
          <button
            type="button"
            className="tb-btn"
            disabled={busy}
            onClick={() => void run(() => openBoardFile(rt))}
          >
            {t('files.openBoard')}
          </button>
        </div>
        <p className="tb-help">{t('files.boardHelp')}</p>
      </section>

      <section className="tb-field" aria-label={t('files.pdf')}>
        <h3 className="tb-section-title">{t('files.pdf')}</h3>
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
      </section>

      <section className="tb-field" aria-label={t('files.export')}>
        <h3 className="tb-section-title">{t('files.export')}</h3>
        <div className="tb-button-column">
          <button
            type="button"
            className="tb-btn"
            disabled={busy}
            onClick={() => void run(() => exportPng(rt))}
          >
            {t('files.exportPng')}
          </button>
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
      </section>

      <Versions key={currentId ?? ''} />

      <LessonLibrary folderId={folderId} onFolderChange={setFolderId} run={run} />
    </SidePanel>
  );
}

function Versions() {
  const rt = useRuntime();
  const [versions, setVersions] = useState<VersionMeta[] | null>(null);
  const [open, setOpen] = useState(false);
  const [toRestore, setToRestore] = useState<VersionMeta | null>(null);

  const load = async () => setVersions(await rt.lessons.getState().listVersions());

  return (
    <section className="tb-field" aria-label={t('files.versions')}>
      <h3 className="tb-section-title">{t('files.versions')}</h3>
      <p className="tb-help">{t('files.versions.help')}</p>
      {!open ? (
        <button
          type="button"
          className="tb-btn"
          onClick={() => {
            setOpen(true);
            void load();
          }}
        >
          {t('files.versions')}
        </button>
      ) : versions && versions.length === 0 ? (
        <p className="tb-help">{t('files.versions.empty')}</p>
      ) : (
        <ul className="tb-version-list">
          {versions?.map((v) => (
            <li key={v.id}>
              <span>
                {dateFmt.format(v.savedAt)}
                <span className="tb-lesson-meta">
                  {' '}
                  · {t(`files.versions.reason.${v.reason}`)} ·{' '}
                  {v.pageCount === 1
                    ? t('files.versions.onePage')
                    : t('files.versions.pages', { n: v.pageCount })}
                </span>
              </span>
              <button type="button" className="tb-btn tb-btn-small" onClick={() => setToRestore(v)}>
                {t('files.versions.restore')}
              </button>
            </li>
          ))}
        </ul>
      )}
      {toRestore && (
        <ConfirmDialog
          title={t('files.versions.confirmTitle', { date: dateFmt.format(toRestore.savedAt) })}
          message={t('files.versions.confirmMessage')}
          confirmLabel={t('files.versions.restore')}
          cancelLabel={t('common.cancel')}
          onConfirm={() => {
            const id = toRestore.id;
            setToRestore(null);
            void rt.lessons.getState().restoreVersion(id).then(load);
          }}
          onCancel={() => setToRestore(null)}
        />
      )}
    </section>
  );
}

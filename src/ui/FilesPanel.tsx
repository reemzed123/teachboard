import { Copy, Pencil, Trash2 } from 'lucide-react';
import { useEffect, useId, useMemo, useState } from 'react';
import { useStore } from 'zustand';
import { useRuntime } from '../app/StoreContext';
import {
  exportPdfFile,
  exportPng,
  openBoardFile,
  saveBoardFile,
} from '../features/lessons/fileActions';
import { t } from '../i18n';
import type { LessonMeta, VersionMeta } from '../platform/types';
import { ConfirmDialog } from './ConfirmDialog';
import { IconButton } from './IconButton';
import { SidePanel } from './SidePanel';

const dateFmt = new Intl.DateTimeFormat('he-IL', { dateStyle: 'short', timeStyle: 'short' });

/** ניהול שיעורים וקבצים: שיעור חדש, פתיחה, שמירה כקובץ, ייצוא, גרסאות, ורשימת השיעורים. */
export function FilesPanel() {
  const rt = useRuntime();
  const lessons = useStore(rt.lessons, (s) => s.lessons);
  const currentId = useStore(rt.lessons, (s) => s.lessonId);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [toDelete, setToDelete] = useState<LessonMeta | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const searchId = useId();

  useEffect(() => {
    void rt.lessons.getState().refreshList();
  }, [rt]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? lessons.filter((l) => l.title.toLowerCase().includes(q)) : lessons;
  }, [lessons, query]);

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
            onClick={() => void run(() => rt.lessons.getState().newLesson())}
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

      <section className="tb-field" aria-label={t('files.mine')}>
        <h3 className="tb-section-title">{t('files.mine')}</h3>
        <input
          id={searchId}
          className="tb-input"
          type="search"
          placeholder={t('files.search')}
          aria-label={t('files.search')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {filtered.length === 0 && <p className="tb-help">{t('files.noResults')}</p>}
        <ul className="tb-lesson-list">
          {filtered.map((l) => (
            <li
              key={l.id}
              className="tb-lesson-item"
              aria-current={l.id === currentId ? 'true' : undefined}
            >
              <button
                type="button"
                className="tb-lesson-open"
                onClick={() => void run(() => rt.lessons.getState().openLesson(l.id))}
                aria-label={`${t('files.open')}: ${l.title}`}
              >
                {l.thumbnail ? (
                  <img className="tb-lesson-thumb" src={l.thumbnail} alt="" />
                ) : (
                  <span className="tb-lesson-thumb" aria-hidden="true" />
                )}
                <span className="tb-lesson-info">
                  {renaming === l.id ? null : <span className="tb-lesson-name">{l.title}</span>}
                  <span className="tb-lesson-meta">
                    {t('files.updated', { date: dateFmt.format(l.updatedAt) })} ·{' '}
                    {l.pageCount === 1
                      ? t('files.versions.onePage')
                      : t('files.versions.pages', { n: l.pageCount })}
                    {l.id === currentId && (
                      <span className="tb-badge">{t('files.current.badge')}</span>
                    )}
                  </span>
                </span>
              </button>
              {renaming === l.id && (
                <input
                  className="tb-input tb-rename"
                  aria-label={t('files.rename')}
                  defaultValue={l.title}
                  autoFocus
                  maxLength={120}
                  onBlur={(e) => {
                    setRenaming(null);
                    void rt.lessons.getState().renameLesson(l.id, e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                    if (e.key === 'Escape') setRenaming(null);
                  }}
                />
              )}
              <div className="tb-lesson-actions">
                <IconButton
                  icon={Pencil}
                  label={t('files.rename')}
                  tooltipSide="above"
                  onClick={() => setRenaming(l.id)}
                />
                <IconButton
                  icon={Copy}
                  label={t('files.duplicate')}
                  tooltipSide="above"
                  onClick={() => void run(() => rt.lessons.getState().duplicateLesson(l.id))}
                />
                <IconButton
                  icon={Trash2}
                  label={t('files.delete')}
                  tooltipSide="above"
                  onClick={() => setToDelete(l)}
                />
              </div>
            </li>
          ))}
        </ul>
      </section>

      {toDelete && (
        <ConfirmDialog
          title={t('files.delete.title', { title: toDelete.title })}
          message={t('files.delete.message')}
          confirmLabel={t('files.delete.confirm')}
          cancelLabel={t('common.cancel')}
          danger
          onConfirm={() => {
            const id = toDelete.id;
            setToDelete(null);
            void run(() => rt.lessons.getState().deleteLesson(id));
          }}
          onCancel={() => setToDelete(null)}
        />
      )}
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

import {
  ArrowLeft,
  Copy,
  FileText,
  Folder,
  FolderOpen,
  Grid3x3,
  Infinity as InfinityIcon,
  Mail,
  Rows3,
  Search,
  Square,
  X,
} from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { useStore } from 'zustand';
import { useApp, useRuntime } from '../app/StoreContext';
import type { BackgroundPattern, BoardDocument, PageLayout } from '../core/document/types';
import { DEFAULT_BACKGROUND, DOCUMENT_VERSION } from '../core/document/types';
import { createPage } from '../features/board/boardStore';
import { importPdf, openBoardFile } from '../features/lessons/fileActions';
import { t } from '../i18n';
import type { MessageKey } from '../i18n/he';
import { APP_VERSION } from '../platform/desktop';

/** פרטי היוצר (מוצגים בתחתית מסך הפתיחה) */
export const CREATOR = { email: 'reemzedek@gmail.com' } as const;

const dateFmt = new Intl.DateTimeFormat('he-IL', { dateStyle: 'medium' });

interface StartOption {
  id: string;
  label: MessageKey;
  hint: MessageKey;
  icon: ReactNode;
  run(): Promise<void>;
}

/** מסך הפתיחה: לוח חדש לפי סוג, שיעורים אחרונים, תיקיות, חיפוש ופרטי היוצר. */
export function StartScreen() {
  const rt = useRuntime();
  const lessons = useStore(rt.lessons, (s) => s.lessons);
  const folders = useStore(rt.lessons, (s) => s.folders);
  const currentId = useStore(rt.lessons, (s) => s.lessonId);
  const showOnStart = useApp((s) => s.settings.showStartScreen);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const close = () => rt.app.getState().setStartScreen(false);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
      close();
    } finally {
      setBusy(false);
    }
  };

  /** שיעור חדש עם עמוד ראשון מהסוג שנבחר */
  const newBoard = (layout: PageLayout, pattern: BackgroundPattern) => async () => {
    const doc: BoardDocument = {
      version: DOCUMENT_VERSION,
      pages: [createPage({ layout, background: { ...DEFAULT_BACKGROUND, pattern } })],
    };
    await rt.lessons.getState().importLesson(doc, t('lesson.untitled'));
  };

  const options: StartOption[] = [
    {
      id: 'blank',
      label: 'start.blank',
      hint: 'start.blank.hint',
      icon: <Square size={30} />,
      run: newBoard('bounded', 'none'),
    },
    {
      id: 'grid',
      label: 'start.grid',
      hint: 'start.grid.hint',
      icon: <Grid3x3 size={30} />,
      run: newBoard('bounded', 'grid'),
    },
    {
      id: 'lines',
      label: 'start.lines',
      hint: 'start.lines.hint',
      icon: <Rows3 size={30} />,
      run: newBoard('bounded', 'lines'),
    },
    {
      id: 'infinite',
      label: 'start.infinite',
      hint: 'start.infinite.hint',
      icon: <InfinityIcon size={30} />,
      run: newBoard('infinite', 'none'),
    },
    {
      id: 'pdf',
      label: 'start.pdf',
      hint: 'start.pdf.hint',
      icon: <FileText size={30} />,
      run: () => importPdf(rt, 'new'),
    },
    {
      id: 'file',
      label: 'start.file',
      hint: 'start.file.hint',
      icon: <FolderOpen size={30} />,
      run: () => openBoardFile(rt),
    },
  ];

  const recent = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = [...lessons].sort((a, b) => b.updatedAt - a.updatedAt);
    return (q ? list.filter((l) => l.title.toLowerCase().includes(q)) : list).slice(0, 8);
  }, [lessons, query]);
  const rootFolders = folders
    .filter((f) => !f.parentId)
    .sort((a, b) => a.name.localeCompare(b.name, 'he'));

  return (
    <div
      className="tb-start"
      role="dialog"
      aria-modal="true"
      aria-label={t('start.title')}
      data-testid="start-screen"
    >
      <div className="tb-start-inner">
        <header className="tb-start-head">
          <img src="icon.svg" alt="" className="tb-start-logo" width={64} height={64} />
          <div>
            <h1>TeachBoard</h1>
            <p>{t('app.tagline')}</p>
          </div>
          <button
            type="button"
            className="tb-start-close"
            onClick={close}
            aria-label={t('start.close')}
            title={t('start.close')}
          >
            <X size={22} />
          </button>
        </header>

        {currentId && (
          <button
            type="button"
            className="tb-btn tb-btn-primary tb-start-continue"
            onClick={close}
            data-testid="start-continue"
          >
            {t('start.continue')}
            <ArrowLeft size={18} aria-hidden="true" />
          </button>
        )}

        <section aria-label={t('start.new')}>
          <h2>{t('start.new')}</h2>
          <div className="tb-start-cards">
            {options.map((o) => (
              <button
                key={o.id}
                type="button"
                className="tb-start-card"
                data-start={o.id}
                disabled={busy}
                onClick={() => void run(o.run)}
              >
                <span className="tb-start-card-icon" aria-hidden="true">
                  {o.icon}
                </span>
                <strong>{t(o.label)}</strong>
                <small>{t(o.hint)}</small>
              </button>
            ))}
          </div>
        </section>

        <section aria-label={t('start.recent')}>
          <div className="tb-start-row">
            <h2>{t('start.recent')}</h2>
            <label className="tb-start-search">
              <Search size={16} aria-hidden="true" />
              <input
                type="search"
                placeholder={t('files.search')}
                aria-label={t('files.search')}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
          </div>
          {recent.length === 0 ? (
            <p className="tb-help">{query ? t('files.noResults') : t('start.noLessons')}</p>
          ) : (
            <div className="tb-start-recent">
              {recent.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  className="tb-start-lesson"
                  data-lesson={l.id}
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      if (l.id !== currentId) await rt.lessons.getState().openLesson(l.id);
                    })
                  }
                >
                  <span className="tb-start-thumb">
                    {l.thumbnail ? (
                      <img src={l.thumbnail} alt="" />
                    ) : (
                      <Square size={28} aria-hidden="true" />
                    )}
                  </span>
                  <strong>{l.title}</strong>
                  <small>
                    {l.id === currentId ? t('files.current.badge') : dateFmt.format(l.updatedAt)}
                  </small>
                </button>
              ))}
            </div>
          )}
        </section>

        {rootFolders.length > 0 && (
          <section aria-label={t('start.folders')}>
            <h2>{t('start.folders')}</h2>
            <div className="tb-start-folders">
              {rootFolders.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className="tb-start-folder"
                  onClick={() => rt.app.getState().openFolder(f.id)}
                >
                  <Folder size={18} aria-hidden="true" />
                  {f.name}
                </button>
              ))}
              <button
                type="button"
                className="tb-start-folder"
                onClick={() => rt.app.getState().openFolder(null)}
              >
                <FolderOpen size={18} aria-hidden="true" />
                {t('start.allLessons')}
              </button>
            </div>
          </section>
        )}

        <footer className="tb-start-foot">
          <label className="tb-check">
            <input
              type="checkbox"
              checked={showOnStart}
              onChange={(e) => rt.app.getState().setShowStartScreen(e.target.checked)}
            />
            {t('start.showOnStart')}
          </label>
          <div className="tb-start-creator" data-testid="start-creator">
            <span>{t('start.creator')}</span>
            <a href={`mailto:${CREATOR.email}`} dir="ltr">
              <Mail size={15} aria-hidden="true" />
              {CREATOR.email}
            </a>
            <button
              type="button"
              className="tb-icon-mini"
              aria-label={t('start.copyEmail')}
              title={t('start.copyEmail')}
              onClick={() =>
                void navigator.clipboard
                  ?.writeText(CREATOR.email)
                  .then(() => rt.app.getState().notify('info', t('start.copied')))
                  .catch(() => rt.app.getState().notify('error', t('start.copyFailed')))
              }
            >
              <Copy size={15} />
            </button>
            <span className="tb-start-version">{t('app.version', { v: APP_VERSION })}</span>
          </div>
        </footer>
      </div>
    </div>
  );
}

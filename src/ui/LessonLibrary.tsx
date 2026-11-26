import { ChevronLeft, Copy, Folder, FolderInput, FolderPlus, Pencil, Trash2 } from 'lucide-react';
import { useMemo, useState, type DragEvent } from 'react';
import { useStore } from 'zustand';
import { useRuntime } from '../app/StoreContext';
import { t } from '../i18n';
import type { FolderMeta, LessonMeta } from '../platform/types';
import { ConfirmDialog } from './ConfirmDialog';
import { IconButton } from './IconButton';

const dateFmt = new Intl.DateTimeFormat('he-IL', { dateStyle: 'short', timeStyle: 'short' });

type DragItem = { kind: 'lesson' | 'folder'; id: string };
const DRAG_TYPE = 'application/x-teachboard-item';

/** הנתיב מהראשי עד התיקייה (לסרגל הניווט) */
function pathTo(folders: FolderMeta[], id: string | null): FolderMeta[] {
  const out: FolderMeta[] = [];
  for (let f = folders.find((x) => x.id === id); f; f = folders.find((x) => x.id === f!.parentId)) {
    out.unshift(f);
    if (out.length > 50) break;
  }
  return out;
}

/** כל התיקיות כרשימה שטוחה עם הזחה (לבחירת "העברה אל") */
function flatTree(
  folders: FolderMeta[],
  parent: string | null = null,
  depth = 0,
): { f: FolderMeta; depth: number }[] {
  return folders
    .filter((f) => f.parentId === parent)
    .sort((a, b) => a.name.localeCompare(b.name, 'he'))
    .flatMap((f) => [{ f, depth }, ...flatTree(folders, f.id, depth + 1)]);
}

/**
 * ספריית השיעורים: תיקיות ותתי-תיקיות, חיפוש, וגרירת שיעורים ותיקיות לתיקיות.
 * לכל פעולת גרירה יש גם חלופה בלחיצה ("העברה אל…") – נוח עם עט ומסך מגע.
 */
export function LessonLibrary({
  folderId,
  onFolderChange,
  run,
}: {
  folderId: string | null;
  onFolderChange(id: string | null): void;
  run(fn: () => Promise<void>): Promise<void>;
}) {
  const rt = useRuntime();
  const lessons = useStore(rt.lessons, (s) => s.lessons);
  const folders = useStore(rt.lessons, (s) => s.folders);
  const currentId = useStore(rt.lessons, (s) => s.lessonId);
  const [query, setQuery] = useState('');
  const [renaming, setRenaming] = useState<string | null>(null);
  const [moving, setMoving] = useState<DragItem | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<{
    kind: 'lesson' | 'folder';
    id: string;
    name: string;
  } | null>(null);
  const L = () => rt.lessons.getState();

  const q = query.trim().toLowerCase();
  const path = pathTo(folders, folderId);
  const subFolders = useMemo(
    () =>
      folders
        .filter((f) => f.parentId === folderId)
        .sort((a, b) => a.name.localeCompare(b.name, 'he')),
    [folders, folderId],
  );
  // בחיפוש: כל השיעורים בכל התיקיות; אחרת – רק בתיקייה הנוכחית
  const shown = q
    ? lessons.filter((l) => l.title.toLowerCase().includes(q))
    : lessons.filter((l) => (l.folderId ?? null) === folderId);

  const folderPathName = (id: string | null | undefined) =>
    pathTo(folders, id ?? null)
      .map((f) => f.name)
      .join(' / ');

  const moveTo = async (item: DragItem, target: string | null) => {
    if (item.kind === 'lesson') await L().moveLesson(item.id, target);
    else if (!(await L().moveFolder(item.id, target))) {
      rt.app.getState().notify('error', t('folders.cannotMoveInside'));
    }
  };

  // ---------- גרירה ----------
  const dragProps = (item: DragItem) => ({
    draggable: true,
    onDragStart: (e: DragEvent) => {
      e.dataTransfer.setData(DRAG_TYPE, JSON.stringify(item));
      e.dataTransfer.effectAllowed = 'move';
    },
  });
  const dropProps = (target: string | null, key: string) => ({
    onDragOver: (e: DragEvent) => {
      if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
      e.preventDefault();
      setDropTarget(key);
    },
    onDragLeave: () => setDropTarget((d) => (d === key ? null : d)),
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      setDropTarget(null);
      try {
        const item = JSON.parse(e.dataTransfer.getData(DRAG_TYPE)) as DragItem;
        if (item.kind === 'folder' && item.id === target) return;
        void run(() => moveTo(item, target));
      } catch {
        // גרירה של משהו אחר – מתעלמים
      }
    },
    'data-drop-active': dropTarget === key || undefined,
  });

  return (
    <section className="tb-field" aria-label={t('files.mine')}>
      <h3 className="tb-section-title">{t('files.mine')}</h3>
      <input
        className="tb-input"
        type="search"
        placeholder={t('files.search')}
        aria-label={t('files.search')}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {!q && (
        <>
          <nav className="tb-breadcrumb" aria-label={t('folders.path')}>
            <button
              type="button"
              className="tb-crumb"
              onClick={() => onFolderChange(null)}
              {...dropProps(null, 'root')}
            >
              {t('folders.root')}
            </button>
            {path.map((f) => (
              <span key={f.id} className="tb-crumb-wrap">
                <ChevronLeft size={14} aria-hidden="true" />
                <button
                  type="button"
                  className="tb-crumb"
                  onClick={() => onFolderChange(f.id)}
                  {...dropProps(f.id, `crumb-${f.id}`)}
                >
                  {f.name}
                </button>
              </span>
            ))}
          </nav>
          <div className="tb-button-row">
            <button
              type="button"
              className="tb-btn"
              onClick={() =>
                void run(async () => {
                  const f = await L().createFolder(t('folder.untitled'), folderId);
                  setRenaming(f.id);
                })
              }
            >
              <FolderPlus size={16} aria-hidden="true" /> {t('folders.new')}
            </button>
          </div>

          <ul className="tb-lesson-list">
            {subFolders.map((f) => (
              <li
                key={f.id}
                className="tb-lesson-item tb-folder-item"
                {...dragProps({ kind: 'folder', id: f.id })}
                {...dropProps(f.id, f.id)}
              >
                {renaming === f.id ? (
                  <input
                    className="tb-input tb-rename"
                    aria-label={t('folders.rename')}
                    defaultValue={f.name}
                    autoFocus
                    maxLength={80}
                    onFocus={(e) => e.target.select()}
                    onBlur={(e) => {
                      setRenaming(null);
                      void L().renameFolder(f.id, e.target.value);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                      if (e.key === 'Escape') setRenaming(null);
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    className="tb-lesson-open"
                    onClick={() => onFolderChange(f.id)}
                    aria-label={`${t('folders.open')}: ${f.name}`}
                  >
                    <Folder size={22} aria-hidden="true" className="tb-folder-icon" />
                    <span className="tb-lesson-name">{f.name}</span>
                  </button>
                )}
                <div className="tb-lesson-actions">
                  <IconButton
                    icon={Pencil}
                    label={t('folders.rename')}
                    tooltipSide="above"
                    onClick={() => setRenaming(f.id)}
                  />
                  <IconButton
                    icon={FolderInput}
                    label={t('folders.moveTo')}
                    tooltipSide="above"
                    onClick={() => setMoving({ kind: 'folder', id: f.id })}
                  />
                  <IconButton
                    icon={Trash2}
                    label={t('folders.delete')}
                    tooltipSide="above"
                    onClick={() => setToDelete({ kind: 'folder', id: f.id, name: f.name })}
                  />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {shown.length === 0 && (q || subFolders.length === 0) && (
        <p className="tb-help">{q ? t('files.noResults') : t('folders.empty')}</p>
      )}
      <ul className="tb-lesson-list">
        {shown.map((l: LessonMeta) => (
          <li
            key={l.id}
            className="tb-lesson-item"
            aria-current={l.id === currentId ? 'true' : undefined}
            {...dragProps({ kind: 'lesson', id: l.id })}
          >
            <button
              type="button"
              className="tb-lesson-open"
              onClick={() => void run(() => L().openLesson(l.id))}
              aria-label={`${t('files.open')}: ${l.title}`}
            >
              {l.thumbnail ? (
                <img className="tb-lesson-thumb" src={l.thumbnail} alt="" draggable={false} />
              ) : (
                <span className="tb-lesson-thumb" aria-hidden="true" />
              )}
              <span className="tb-lesson-info">
                {renaming !== l.id && <span className="tb-lesson-name">{l.title}</span>}
                <span className="tb-lesson-meta">
                  {t('files.updated', { date: dateFmt.format(l.updatedAt) })} ·{' '}
                  {l.pageCount === 1
                    ? t('files.versions.onePage')
                    : t('files.versions.pages', { n: l.pageCount })}
                  {l.id === currentId && (
                    <span className="tb-badge">{t('files.current.badge')}</span>
                  )}
                </span>
                {q && l.folderId && (
                  <span className="tb-lesson-meta">📁 {folderPathName(l.folderId)}</span>
                )}
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
                  void L().renameLesson(l.id, e.target.value);
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
                icon={FolderInput}
                label={t('folders.moveTo')}
                tooltipSide="above"
                onClick={() => setMoving({ kind: 'lesson', id: l.id })}
              />
              <IconButton
                icon={Copy}
                label={t('files.duplicate')}
                tooltipSide="above"
                onClick={() => void run(() => L().duplicateLesson(l.id))}
              />
              <IconButton
                icon={Trash2}
                label={t('files.delete')}
                tooltipSide="above"
                onClick={() => setToDelete({ kind: 'lesson', id: l.id, name: l.title })}
              />
            </div>
          </li>
        ))}
      </ul>

      {moving && (
        <MoveDialog
          folders={folders}
          item={moving}
          onClose={() => setMoving(null)}
          onMove={(target) => {
            const item = moving;
            setMoving(null);
            void run(() => moveTo(item, target));
          }}
        />
      )}

      {toDelete && (
        <ConfirmDialog
          title={
            toDelete.kind === 'lesson'
              ? t('files.delete.title', { title: toDelete.name })
              : t('folders.delete.title', { name: toDelete.name })
          }
          message={
            toDelete.kind === 'lesson' ? t('files.delete.message') : t('folders.delete.message')
          }
          confirmLabel={
            toDelete.kind === 'lesson' ? t('files.delete.confirm') : t('folders.delete.confirm')
          }
          cancelLabel={t('common.cancel')}
          danger
          onConfirm={() => {
            const d = toDelete;
            setToDelete(null);
            void run(() => (d.kind === 'lesson' ? L().deleteLesson(d.id) : L().deleteFolder(d.id)));
          }}
          onCancel={() => setToDelete(null)}
        />
      )}
    </section>
  );
}

/** חלון "העברה אל…": בחירת תיקייה מתוך עץ התיקיות */
function MoveDialog({
  folders,
  item,
  onMove,
  onClose,
}: {
  folders: FolderMeta[];
  item: DragItem;
  onMove(target: string | null): void;
  onClose(): void;
}) {
  // תיקייה לא יכולה לעבור לתוך עצמה או לתתי-התיקיות שלה
  const blocked = new Set<string>();
  if (item.kind === 'folder') {
    const add = (id: string) => {
      blocked.add(id);
      folders.filter((f) => f.parentId === id).forEach((f) => add(f.id));
    };
    add(item.id);
  }
  const options = flatTree(folders).filter((o) => !blocked.has(o.f.id));
  return (
    <ConfirmLikeDialog title={t('folders.moveTo')} onClose={onClose}>
      <ul className="tb-move-list">
        <li>
          <button type="button" className="tb-move-option" onClick={() => onMove(null)}>
            {t('folders.root')}
          </button>
        </li>
        {options.map(({ f, depth }) => (
          <li key={f.id}>
            <button
              type="button"
              className="tb-move-option"
              style={{ paddingInlineStart: 12 + depth * 18 }}
              onClick={() => onMove(f.id)}
            >
              <Folder size={16} aria-hidden="true" /> {f.name}
            </button>
          </li>
        ))}
      </ul>
    </ConfirmLikeDialog>
  );
}

function ConfirmLikeDialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose(): void;
}) {
  return (
    <dialog
      className="tb-dialog"
      aria-label={title}
      ref={(d) => {
        if (d && !d.open) d.showModal?.();
      }}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <h2>{title}</h2>
      {children}
      <div className="tb-dialog-actions">
        <button type="button" className="tb-btn" onClick={onClose}>
          {t('common.cancel')}
        </button>
      </div>
    </dialog>
  );
}

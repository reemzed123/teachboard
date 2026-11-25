import { ChevronLeft, ChevronRight, Copy, MoveLeft, MoveRight, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useBoard, useRuntime } from '../app/StoreContext';
import { t } from '../i18n';
import { ConfirmDialog } from './ConfirmDialog';
import { IconButton } from './IconButton';

// סרגל העמודים בתחתית הלוח: מעבר בין עמודים, הוספה, שכפול, הזזה ומחיקה.
// בכיוון ימין-לשמאל: "הבא" הוא שמאלה.

export function PageStrip() {
  const rt = useRuntime();
  const pages = useBoard((s) => s.doc.pages);
  const pageId = useBoard((s) => s.pageId);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const index = pages.findIndex((p) => p.id === pageId);
  const board = () => rt.board.getState();

  return (
    <div className="tb-pages" role="toolbar" aria-label={t('pages.label')}>
      <IconButton
        icon={ChevronRight}
        label={t('pages.prev')}
        tooltipSide="above"
        disabled={index <= 0}
        onClick={() => board().goToPage(pages[index - 1]!.id)}
        data-action="page.prev"
      />
      <div className="tb-page-list" role="tablist" aria-label={t('pages.list')}>
        {pages.map((p, i) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={p.id === pageId}
            className="tb-page-btn"
            aria-label={t('pages.page', { n: i + 1 })}
            onClick={() => board().goToPage(p.id)}
          >
            {p.layout === 'infinite' ? '∞' : i + 1}
          </button>
        ))}
      </div>
      <IconButton
        icon={ChevronLeft}
        label={t('pages.next')}
        tooltipSide="above"
        disabled={index >= pages.length - 1}
        onClick={() => board().goToPage(pages[index + 1]!.id)}
        data-action="page.next"
      />
      <span className="tb-pages-sep" aria-hidden="true" />
      <IconButton
        icon={Plus}
        label={t('pages.add')}
        tooltipSide="above"
        onClick={() => board().addPage()}
        data-action="page.add"
      />
      <IconButton
        icon={Copy}
        label={t('pages.duplicate')}
        tooltipSide="above"
        onClick={() => board().duplicatePage(pageId)}
        data-action="page.duplicate"
      />
      <IconButton
        icon={MoveRight}
        label={t('pages.moveEarlier')}
        tooltipSide="above"
        disabled={index <= 0}
        onClick={() => board().movePage(pageId, index - 1)}
        data-action="page.moveEarlier"
      />
      <IconButton
        icon={MoveLeft}
        label={t('pages.moveLater')}
        tooltipSide="above"
        disabled={index >= pages.length - 1}
        onClick={() => board().movePage(pageId, index + 1)}
        data-action="page.moveLater"
      />
      <IconButton
        icon={Trash2}
        label={t('pages.delete')}
        tooltipSide="above"
        disabled={pages.length <= 1}
        onClick={() => setConfirmDelete(true)}
        data-action="page.delete"
      />
      {confirmDelete && (
        <ConfirmDialog
          title={t('pages.delete.title', { n: index + 1 })}
          message={t('pages.delete.message')}
          confirmLabel={t('pages.delete.confirm')}
          cancelLabel={t('common.cancel')}
          danger
          onConfirm={() => {
            board().deletePage(pageId);
            setConfirmDelete(false);
          }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}

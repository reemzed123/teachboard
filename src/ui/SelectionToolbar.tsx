import type { QuickActionId } from '../app/actionIds';
import { useBoard } from '../app/StoreContext';
import { unionRects } from '../core/geometry/rect';
import { objectBounds } from '../core/objects/geometry';
import { currentPage } from '../features/board/boardStore';
import { t } from '../i18n';
import { ActionButton } from './ActionButton';
import { IconButton } from './IconButton';
import { Sigma } from 'lucide-react';
import { useRuntime } from '../app/StoreContext';

const ACTIONS: QuickActionId[] = [
  'edit.duplicate',
  'edit.copy',
  'edit.bringFront',
  'edit.sendBack',
  'edit.group',
  'edit.ungroup',
  'edit.lock',
  'edit.deleteSelection',
];

const LOCKED_ACTIONS: QuickActionId[] = ['edit.unlock', 'edit.copy', 'edit.duplicate'];

/** סרגל קטן שמופיע מעל האובייקטים שנבחרו. */
export function SelectionToolbar() {
  const rt = useRuntime();
  const tool = useBoard((s) => s.tool);
  const selection = useBoard((s) => s.selection);
  const view = useBoard((s) => s.view);
  const objects = useBoard((s) => currentPage(s).objects);
  if (tool !== 'select' || selection.length === 0) return null;

  const ids = new Set(selection);
  const selected = objects.filter((o) => ids.has(o.id));
  const b = unionRects(selected.map(objectBounds));
  // בחירה נעולה: רק ביטול נעילה, העתקה ושכפול
  const actions = selected.some((o) => o.locked) ? LOCKED_ACTIONS : ACTIONS;
  if (!b) return null;
  const centerX = (b.x + b.width / 2) * view.scale + view.x;
  const top = b.y * view.scale + view.y;
  const bottom = (b.y + b.height) * view.scale + view.y;
  // מעל הבחירה (מעל ידית הסיבוב); אם אין מקום – מתחתיה
  const above = top - 92 > 8;
  return (
    <div
      className="tb-selection-bar"
      role="toolbar"
      aria-label={t('selection.toolbar')}
      style={{
        left: centerX,
        top: above ? top - 92 : bottom + 20,
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {selected.length === 1 && (selected[0]!.type === 'math' || selected[0]!.type === 'graph') && (
        <IconButton
          icon={Sigma}
          label={selected[0]!.type === 'math' ? t('math.editFormula') : t('math.editGraph')}
          tooltipSide={above ? 'above' : 'below'}
          data-action="edit.math"
          onClick={() => {
            const o = selected[0]!;
            if (o.type === 'math') rt.board.getState().openFormula(o.id);
            else rt.board.getState().requestPanel('math');
          }}
        />
      )}
      {actions.map((id) => (
        <ActionButton key={id} id={id} tooltipSide={above ? 'above' : 'below'} />
      ))}
    </div>
  );
}

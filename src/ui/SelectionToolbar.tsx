import type { QuickActionId } from '../app/actionIds';
import { useBoard } from '../app/StoreContext';
import { unionRects } from '../core/geometry/rect';
import { objectBounds } from '../core/objects/geometry';
import { currentPage } from '../features/board/boardStore';
import { t } from '../i18n';
import { ActionButton } from './ActionButton';

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

/** סרגל קטן שמופיע מעל האובייקטים שנבחרו. */
export function SelectionToolbar() {
  const tool = useBoard((s) => s.tool);
  const selection = useBoard((s) => s.selection);
  const view = useBoard((s) => s.view);
  const objects = useBoard((s) => currentPage(s).objects);
  if (tool !== 'select' || selection.length === 0) return null;

  const ids = new Set(selection);
  const b = unionRects(objects.filter((o) => ids.has(o.id)).map(objectBounds));
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
      {ACTIONS.map((id) => (
        <ActionButton key={id} id={id} tooltipSide={above ? 'above' : 'below'} />
      ))}
    </div>
  );
}

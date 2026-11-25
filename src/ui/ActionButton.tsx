import { actionTooltip, ACTIONS } from '../app/actions';
import type { QuickActionId } from '../app/actionIds';
import { useApp, useBoard, useRuntime } from '../app/StoreContext';
import { t } from '../i18n';
import { IconButton } from './IconButton';

/** לחצן שמפעיל פעולה מהרשימה המרכזית, ומתעדכן לפי מצבה (פעיל / זמין). */
export function ActionButton({
  id,
  tooltipSide = 'below',
}: {
  id: QuickActionId;
  tooltipSide?: 'below' | 'end' | 'above';
}) {
  const rt = useRuntime();
  const action = ACTIONS[id];
  // ננעלים על המצבים שמשפיעים על הלחצן, כדי שיתעדכן.
  useBoard((s) => s.tool);
  useBoard((s) => s.history);
  useBoard((s) => s.selection);
  useApp((s) => s.categoryBarVisible);
  const enabled = action.isEnabled ? action.isEnabled(rt) : true;

  return (
    <IconButton
      icon={action.icon}
      label={actionTooltip(t(action.labelKey), action.shortcut)}
      tooltipSide={tooltipSide}
      pressed={action.isActive?.(rt)}
      disabled={!enabled}
      onClick={() => action.run(rt)}
      data-action={action.id}
    />
  );
}

import { ACTIONS } from '../app/actions';
import type { QuickActionId } from '../app/actionIds';
import { useApp, useAppStore } from '../app/StoreContext';
import { t } from '../i18n';
import { IconButton } from './IconButton';

export function QuickAccessBar() {
  const store = useAppStore();
  const slots = useApp((s) => s.settings.quickAccess);
  // ננעלים על המצבים שמשפיעים על לחצנים "לחוצים", כדי שהסרגל יתעדכן.
  useApp((s) => s.categoryBarVisible);

  const actions = slots
    .filter((id): id is string => id !== null)
    .map((id) => ACTIONS[id as QuickActionId])
    .filter(Boolean);

  if (actions.length === 0) return null;

  return (
    <div className="tb-quick" role="toolbar" aria-label={t('quickAccess.label')}>
      {actions.map((action) => (
        <IconButton
          key={action.id}
          icon={action.icon}
          label={t(action.labelKey)}
          pressed={action.isActive?.(store)}
          onClick={() => action.run(store)}
          data-action={action.id}
        />
      ))}
    </div>
  );
}

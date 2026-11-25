import { ACTIONS } from '../app/actions';
import type { QuickActionId } from '../app/actionIds';
import { useApp } from '../app/StoreContext';
import { t } from '../i18n';
import { ActionButton } from './ActionButton';

export function QuickAccessBar() {
  const slots = useApp((s) => s.settings.quickAccess);
  const ids = slots.filter((id): id is QuickActionId => id !== null && id in ACTIONS);
  if (ids.length === 0) return null;

  return (
    <div className="tb-quick" role="toolbar" aria-label={t('quickAccess.label')}>
      {ids.map((id) => (
        <ActionButton key={id} id={id} />
      ))}
    </div>
  );
}

import { Minimize2 } from 'lucide-react';
import { useApp } from '../app/StoreContext';
import { t } from '../i18n';
import { IconButton } from './IconButton';

export function FocusRestoreButton() {
  const setFocusMode = useApp((s) => s.setFocusMode);
  return (
    <IconButton
      className="tb-focus-restore"
      icon={Minimize2}
      label={t('focus.restore')}
      tooltipSide="end"
      onClick={() => setFocusMode(false)}
    />
  );
}

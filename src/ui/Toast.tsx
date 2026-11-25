import { X } from 'lucide-react';
import { useEffect } from 'react';
import { useApp } from '../app/StoreContext';
import { t } from '../i18n';
import { IconButton } from './IconButton';

/** הודעה קצרה בתחתית המסך. הודעת מידע נעלמת לבד; הודעת שגיאה נשארת עד סגירה. */
export function Toast() {
  const notice = useApp((s) => s.notice);
  const dismiss = useApp((s) => s.dismissNotice);

  useEffect(() => {
    if (!notice || notice.kind === 'error') return;
    const timer = setTimeout(dismiss, 4000);
    return () => clearTimeout(timer);
  }, [notice, dismiss]);

  if (!notice) return null;
  return (
    <div
      className={`tb-toast tb-notice tb-notice-${notice.kind}`}
      role={notice.kind === 'error' ? 'alert' : 'status'}
      data-testid="notice"
    >
      <span>{notice.text}</span>
      <IconButton icon={X} label={t('notice.close')} tooltipSide="above" onClick={dismiss} />
    </div>
  );
}

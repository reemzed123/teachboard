import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useApp } from '../app/StoreContext';
import { t } from '../i18n';
import { IconButton } from './IconButton';

export function SidePanel({ title, children }: { title: string; children: ReactNode }) {
  const closePanel = useApp((s) => s.closePanel);
  return (
    <aside className="tb-panel" aria-label={title}>
      <div className="tb-panel-head">
        <h2>{title}</h2>
        <IconButton icon={X} label={t('panel.close')} onClick={closePanel} tooltipSide="below" />
      </div>
      <div className="tb-panel-body">{children}</div>
    </aside>
  );
}

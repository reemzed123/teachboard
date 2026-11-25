import type { LucideIcon } from 'lucide-react';
import {
  FileText,
  FolderOpen,
  GraduationCap,
  LayoutTemplate,
  PenLine,
  Sigma,
  Triangle,
} from 'lucide-react';
import { useApp } from '../app/StoreContext';
import { CATEGORIES, type CategoryId } from '../features/categories';
import { t } from '../i18n';
import { IconButton } from './IconButton';

const ICONS: Record<CategoryId, LucideIcon> = {
  drawing: PenLine,
  math: Sigma,
  geometry: Triangle,
  pdf: FileText,
  teaching: GraduationCap,
  templates: LayoutTemplate,
  files: FolderOpen,
};

export function CategoryBar() {
  const openPanel = useApp((s) => s.openPanel);
  const togglePanel = useApp((s) => s.togglePanel);

  return (
    <nav className="tb-catbar" aria-label={t('categories.label')}>
      {CATEGORIES.map((c) => (
        <IconButton
          key={c.id}
          icon={ICONS[c.id]}
          label={t(c.labelKey)}
          tooltipSide="end"
          pressed={openPanel === c.id}
          onClick={() => togglePanel(c.id)}
          data-category={c.id}
        />
      ))}
    </nav>
  );
}

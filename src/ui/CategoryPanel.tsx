import type { CategoryDef } from '../features/categories';
import { t } from '../i18n';
import { SidePanel } from './SidePanel';

// כל עוד הכלים של קטגוריה לא נבנו, החלונית אומרת זאת במפורש
// (לא מציגים כלים שלא קיימים).
export function CategoryPanel({ category }: { category: CategoryDef }) {
  return (
    <SidePanel title={t(category.labelKey)}>
      <p className="tb-help">{t('category.plannedPhase', { phase: category.plannedPhase })}</p>
    </SidePanel>
  );
}

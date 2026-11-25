import type { MessageKey } from '../i18n/he';

export type CategoryId =
  'drawing' | 'math' | 'geometry' | 'pdf' | 'teaching' | 'templates' | 'files';

export interface CategoryDef {
  id: CategoryId;
  labelKey: MessageKey;
  /** השלב בתוכנית שבו ייבנו הכלים של הקטגוריה. */
  plannedPhase: number;
}

// הסדר כאן הוא הסדר בסרגל.
export const CATEGORIES: readonly CategoryDef[] = [
  { id: 'drawing', labelKey: 'category.drawing', plannedPhase: 2 },
  { id: 'math', labelKey: 'category.math', plannedPhase: 4 },
  { id: 'geometry', labelKey: 'category.geometry', plannedPhase: 5 },
  { id: 'pdf', labelKey: 'category.pdf', plannedPhase: 6 },
  { id: 'teaching', labelKey: 'category.teaching', plannedPhase: 7 },
  { id: 'templates', labelKey: 'category.templates', plannedPhase: 3 },
  { id: 'files', labelKey: 'category.files', plannedPhase: 3 },
];

import type { MessageKey } from '../i18n/he';

export type CategoryId =
  'drawing' | 'math' | 'geometry' | 'pdf' | 'teaching' | 'templates' | 'files';

export interface CategoryDef {
  id: CategoryId;
  labelKey: MessageKey;
  /** השלב בתוכנית שבו ייבנו הכלים של הקטגוריה. */
  plannedPhase: number;
  /** האם הכלים כבר בנויים */
  available?: boolean;
}

// הסדר כאן הוא הסדר בסרגל.
export const CATEGORIES: readonly CategoryDef[] = [
  { id: 'drawing', labelKey: 'category.drawing', plannedPhase: 2, available: true },
  { id: 'math', labelKey: 'category.math', plannedPhase: 4, available: true },
  { id: 'geometry', labelKey: 'category.geometry', plannedPhase: 5, available: true },
  { id: 'pdf', labelKey: 'category.pdf', plannedPhase: 6, available: true },
  { id: 'teaching', labelKey: 'category.teaching', plannedPhase: 7, available: true },
  { id: 'templates', labelKey: 'category.templates', plannedPhase: 3, available: true },
  { id: 'files', labelKey: 'category.files', plannedPhase: 3, available: true },
];

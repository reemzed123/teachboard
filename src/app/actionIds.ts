// מזהי הפעולות שאפשר לשים בסרגל הגישה המהירה.
// כל פעולה כאן חייבת להיות ממומשת ב-actions.ts (נבדק בבדיקות).
export const QUICK_ACTION_IDS = [
  'tool.pen',
  'tool.highlighter',
  'tool.eraser',
  'tool.select',
  'tool.hand',
  'edit.undo',
  'edit.redo',
  'edit.deleteSelection',
  'view.zoomIn',
  'view.zoomOut',
  'view.zoomFit',
  'view.toggleTheme',
  'view.fullscreen',
  'view.focusMode',
  'view.toggleCategoryBar',
] as const;

export type QuickActionId = (typeof QUICK_ACTION_IDS)[number];

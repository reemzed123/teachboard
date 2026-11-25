// הגדרות המשתמש. קוד טהור – בלי ממשק ובלי גישה לדפדפן,
// כדי שאפשר יהיה לבדוק אותו ולהשתמש בו גם בגרסת Windows.

export const SETTINGS_VERSION = 1;

export type ThemePreference = 'system' | 'light' | 'dark';

/** מספר הלחצנים בסרגל הגישה המהירה. */
export const QUICK_ACCESS_SLOTS = 5;

export interface Settings {
  version: typeof SETTINGS_VERSION;
  theme: ThemePreference;
  /** מזהי פעולות לסרגל הגישה המהירה. null = מקום ריק. */
  quickAccess: (string | null)[];
}

export const DEFAULT_QUICK_ACCESS: readonly string[] = [
  'view.toggleTheme',
  'view.fullscreen',
  'view.focusMode',
  'view.toggleCategoryBar',
];

export function createDefaultSettings(): Settings {
  return {
    version: SETTINGS_VERSION,
    theme: 'system',
    quickAccess: normalizeQuickAccess(DEFAULT_QUICK_ACCESS, DEFAULT_QUICK_ACCESS),
  };
}

/**
 * מסדר רשימת לחצנים: בדיוק 5 מקומות, רק פעולות מוכרות, בלי כפילויות.
 * כל ערך לא תקין הופך למקום ריק.
 */
export function normalizeQuickAccess(
  input: readonly unknown[],
  knownIds: readonly string[],
): (string | null)[] {
  const known = new Set(knownIds);
  const seen = new Set<string>();
  const result: (string | null)[] = [];
  for (let i = 0; i < QUICK_ACCESS_SLOTS; i++) {
    const value = input[i];
    if (typeof value === 'string' && known.has(value) && !seen.has(value)) {
      seen.add(value);
      result.push(value);
    } else {
      result.push(null);
    }
  }
  return result;
}

/**
 * הופך מידע שנקרא מהאחסון (שעלול להיות פגום או ישן) להגדרות תקינות.
 * לעולם לא זורק שגיאה – ערך לא תקין מוחלף בברירת המחדל.
 */
export function parseSettings(raw: unknown, knownActionIds: readonly string[]): Settings {
  const defaults = createDefaultSettings();
  if (typeof raw !== 'object' || raw === null) return defaults;
  const obj = raw as Record<string, unknown>;

  const theme: ThemePreference =
    obj.theme === 'light' || obj.theme === 'dark' || obj.theme === 'system'
      ? obj.theme
      : defaults.theme;

  const quickAccess = Array.isArray(obj.quickAccess)
    ? normalizeQuickAccess(obj.quickAccess, knownActionIds)
    : normalizeQuickAccess(DEFAULT_QUICK_ACCESS, knownActionIds);

  return { version: SETTINGS_VERSION, theme, quickAccess };
}

/** מחליף את הפעולה במקום מסוים; אם היא כבר במקום אחר – המקום האחר מתפנה. */
export function setQuickAccessSlot(
  slots: readonly (string | null)[],
  index: number,
  actionId: string | null,
): (string | null)[] {
  if (index < 0 || index >= QUICK_ACCESS_SLOTS) return [...slots];
  const next = slots.map((id) => (actionId !== null && id === actionId ? null : id));
  next[index] = actionId;
  return next;
}

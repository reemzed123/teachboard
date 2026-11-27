import { create } from 'zustand';
import {
  parseSettings,
  setQuickAccessSlot,
  type Settings,
  type ThemePreference,
} from '../core/settings/settings';
import type { SettingsStorage } from '../platform/types';
import type { CategoryId } from '../features/categories';
import { QUICK_ACTION_IDS } from './actionIds';

export type PanelId = CategoryId | 'settings';

export interface Notice {
  id: number;
  kind: 'info' | 'error';
  text: string;
}

export interface AppState {
  /** הודעה קצרה למשתמש (נעלמת לבד) */
  notice: Notice | null;
  notify(kind: Notice['kind'], text: string): void;
  dismissNotice(): void;
  settings: Settings;
  /** true אם השמירה האחרונה של ההגדרות נכשלה. */
  settingsSaveFailed: boolean;
  openPanel: PanelId | null;
  categoryBarVisible: boolean;
  focusMode: boolean;
  /** מסך הפתיחה מוצג */
  startScreen: boolean;
  /** התיקייה שתוצג בחלונית השיעורים (למשל אחרי בחירה במסך הפתיחה) */
  filesFolder: string | null;

  setStartScreen(on: boolean): void;
  setShowStartScreen(on: boolean): void;
  /** פתיחת חלונית השיעורים בתיקייה מסוימת */
  openFolder(id: string | null): void;
  setTheme(theme: ThemePreference): void;
  setAutoClosePanel(on: boolean): void;
  setQuickAccess(index: number, actionId: string | null): void;
  togglePanel(panel: PanelId): void;
  closePanel(): void;
  toggleCategoryBar(): void;
  setFocusMode(on: boolean): void;
}

export function createAppStore(storage: SettingsStorage) {
  const initial = parseSettings(storage.load(), QUICK_ACTION_IDS);

  return create<AppState>()((set, get) => {
    const updateSettings = (next: Settings) => {
      const ok = storage.save(next);
      set({ settings: next, settingsSaveFailed: !ok });
    };

    let noticeId = 0;
    return {
      notice: null,
      notify: (kind, text) => set({ notice: { id: ++noticeId, kind, text } }),
      dismissNotice: () => set({ notice: null }),
      settings: initial,
      settingsSaveFailed: false,
      openPanel: null,
      categoryBarVisible: true,
      focusMode: false,
      startScreen: false,
      filesFolder: null,

      setStartScreen: (on) => set({ startScreen: on }),
      setShowStartScreen: (showStartScreen) =>
        updateSettings({ ...get().settings, showStartScreen }),
      openFolder: (id) => set({ filesFolder: id, openPanel: 'files', startScreen: false }),
      setTheme: (theme) => updateSettings({ ...get().settings, theme }),
      setAutoClosePanel: (autoClosePanel) => updateSettings({ ...get().settings, autoClosePanel }),
      setQuickAccess: (index, actionId) =>
        updateSettings({
          ...get().settings,
          quickAccess: setQuickAccessSlot(get().settings.quickAccess, index, actionId),
        }),
      togglePanel: (panel) => set({ openPanel: get().openPanel === panel ? null : panel }),
      closePanel: () => set({ openPanel: null }),
      toggleCategoryBar: () => set({ categoryBarVisible: !get().categoryBarVisible }),
      setFocusMode: (on) => set({ focusMode: on, openPanel: on ? null : get().openPanel }),
    };
  });
}

export type AppStore = ReturnType<typeof createAppStore>;

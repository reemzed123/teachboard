import type { LucideIcon } from 'lucide-react';
import { Expand, Focus, PanelRight, SunMoon } from 'lucide-react';
import type { MessageKey } from '../i18n/he';
import type { AppStore } from './store';
import { resolveTheme } from './theme';
import type { QuickActionId } from './actionIds';

export interface ActionDef {
  id: QuickActionId;
  labelKey: MessageKey;
  icon: LucideIcon;
  run(store: AppStore): void;
  /** מצב "פעיל" (לחצן לחוץ), אם רלוונטי. */
  isActive?(store: AppStore): boolean;
}

export const ACTIONS: Record<QuickActionId, ActionDef> = {
  'view.toggleTheme': {
    id: 'view.toggleTheme',
    labelKey: 'action.view.toggleTheme',
    icon: SunMoon,
    run(store) {
      const s = store.getState();
      s.setTheme(resolveTheme(s.settings.theme) === 'dark' ? 'light' : 'dark');
    },
  },
  'view.fullscreen': {
    id: 'view.fullscreen',
    labelKey: 'action.view.fullscreen',
    icon: Expand,
    run() {
      if (document.fullscreenElement) {
        void document.exitFullscreen().catch(() => undefined);
      } else {
        void document.documentElement.requestFullscreen?.().catch(() => undefined);
      }
    },
  },
  'view.focusMode': {
    id: 'view.focusMode',
    labelKey: 'action.view.focusMode',
    icon: Focus,
    run(store) {
      store.getState().setFocusMode(true);
    },
  },
  'view.toggleCategoryBar': {
    id: 'view.toggleCategoryBar',
    labelKey: 'action.view.toggleCategoryBar',
    icon: PanelRight,
    run(store) {
      store.getState().toggleCategoryBar();
    },
    isActive: (store) => store.getState().categoryBarVisible,
  },
};

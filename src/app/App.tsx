import { useEffect } from 'react';
import { CATEGORIES } from '../features/categories';
import { CategoryBar } from '../ui/CategoryBar';
import { CategoryPanel } from '../ui/CategoryPanel';
import { FocusRestoreButton } from '../ui/FocusRestoreButton';
import { SettingsPanel } from '../ui/SettingsPanel';
import { TopBar } from '../ui/TopBar';
import { Workspace } from '../ui/Workspace';
import { useApp, useAppStore } from './StoreContext';
import { applyTheme } from './theme';

export function App() {
  const store = useAppStore();
  const theme = useApp((s) => s.settings.theme);
  const openPanel = useApp((s) => s.openPanel);
  const categoryBarVisible = useApp((s) => s.categoryBarVisible);
  const focusMode = useApp((s) => s.focusMode);

  // מראה: מוחל על המסמך, ומתעדכן גם כשמערכת ההפעלה מחליפה בין בהיר לכהה.
  useEffect(() => {
    applyTheme(theme);
    if (theme !== 'system' || typeof matchMedia !== 'function') return;
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('system');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [theme]);

  // Escape: יציאה ממצב הסתרת סרגלים, או סגירת החלונית הפתוחה.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const s = store.getState();
      if (s.focusMode) s.setFocusMode(false);
      else if (s.openPanel) s.closePanel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [store]);

  const category = CATEGORIES.find((c) => c.id === openPanel);

  return (
    <div className="tb-app" data-focus={focusMode || undefined}>
      {!focusMode && <TopBar />}
      <div className="tb-main">
        {!focusMode && categoryBarVisible && <CategoryBar />}
        {!focusMode && openPanel === 'settings' && <SettingsPanel />}
        {!focusMode && category && <CategoryPanel category={category} />}
        <Workspace />
      </div>
      {focusMode && <FocusRestoreButton />}
    </div>
  );
}

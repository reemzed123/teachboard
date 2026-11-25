import { useEffect } from 'react';
import { CATEGORIES } from '../features/categories';
import { CategoryBar } from '../ui/CategoryBar';
import { CategoryPanel } from '../ui/CategoryPanel';
import { FocusRestoreButton } from '../ui/FocusRestoreButton';
import { SettingsPanel } from '../ui/SettingsPanel';
import { TopBar } from '../ui/TopBar';
import { Workspace } from '../ui/Workspace';
import { DrawingPanel } from '../ui/DrawingPanel';
import { TemplatesPanel } from '../ui/TemplatesPanel';
import { FilesPanel } from '../ui/FilesPanel';
import { Toast } from '../ui/Toast';
import { ErrorBoundary } from '../ui/ErrorBoundary';
import { t } from '../i18n';
import { MathPanel } from '../ui/MathPanel';
import { FormulaDialog } from '../ui/FormulaDialog';
import { handleShortcut } from './shortcuts';
import { useApp, useRuntime } from './StoreContext';
import { applyTheme } from './theme';

function panelFailed(rt: ReturnType<typeof useRuntime>) {
  rt.app.getState().closePanel();
  rt.app.getState().notify('error', t('error.part'));
}

export function App() {
  const rt = useRuntime();
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

  // בקשה מהלוח לפתוח חלונית (למשל לחיצה כפולה על גרף)
  useEffect(
    () =>
      rt.board.subscribe((s) => {
        if (!s.panelRequest) return;
        const app = rt.app.getState();
        if (app.openPanel !== s.panelRequest) app.togglePanel(s.panelRequest as 'math');
        s.requestPanel(null);
      }),
    [rt],
  );

  // מקלדת: קיצורים, ו-Escape (ביטול בחירה → יציאה ממצב הסתרת סרגלים → סגירת חלונית).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (document.querySelector('dialog[open]')) return;
        const board = rt.board.getState();
        const s = rt.app.getState();
        if (board.selection.length > 0) board.setSelection([]);
        else if (s.focusMode) s.setFocusMode(false);
        else if (s.openPanel) s.closePanel();
        return;
      }
      handleShortcut(e, rt);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [rt]);

  const category = CATEGORIES.find((c) => c.id === openPanel);

  return (
    <div className="tb-app" data-focus={focusMode || undefined}>
      {!focusMode && <TopBar />}
      <div className="tb-main">
        {!focusMode && categoryBarVisible && <CategoryBar />}
        {!focusMode && openPanel && (
          // חלונית שנכשלה נסגרת לבד – בלי להפיל את התוכנה
          <ErrorBoundary key={openPanel} fallback={() => null} onError={() => panelFailed(rt)}>
            {openPanel === 'settings' && <SettingsPanel />}
            {category?.id === 'drawing' && <DrawingPanel />}
            {category?.id === 'templates' && <TemplatesPanel />}
            {category?.id === 'files' && <FilesPanel />}
            {category?.id === 'math' && <MathPanel />}
            {category && !category.available && <CategoryPanel category={category} />}
          </ErrorBoundary>
        )}
        <Workspace />
      </div>
      {focusMode && <FocusRestoreButton />}
      <ErrorBoundary
        fallback={() => null}
        onError={() => {
          rt.board.getState().closeFormula();
          rt.app.getState().notify('error', t('error.dialog'));
        }}
      >
        <FormulaDialog />
      </ErrorBoundary>
      <Toast />
    </div>
  );
}

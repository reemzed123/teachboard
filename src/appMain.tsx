import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/heebo';
import { App } from './app/App';
import { createAppStore } from './app/store';
import { RuntimeContext } from './app/StoreContext';
import type { AppRuntime } from './app/runtime';
import { createBoardStore } from './features/board/boardStore';
import { prepareMath, thumbnailDataUrl } from './features/export/renderPage';
import { AssetCache } from './features/lessons/assetCache';
import { createLessonController } from './features/lessons/lessonController';
import { createWebLessonRepository } from './platform/web/lessonRepository';
import { t } from './i18n';
import { applyTheme } from './app/theme';
import { setLocale } from './i18n';
import { createWebSettingsStorage } from './platform/web/settingsStorage';
import { UpdatePrompt } from './ui/UpdatePrompt';
import { ErrorBoundary } from './ui/ErrorBoundary';
import { createTeachingStore } from './features/teaching/teachingStore';
import { installPwaListeners, requestPersistence } from './platform/web/pwa';
import { handleLaunchedFiles } from './features/lessons/launchFiles';
import { isDesktopApp } from './platform/desktop';
import { installTeacherSync } from './features/projector/teacherSync';
import { setObjectImageSource } from './engine/render/drawObject';
import { installPageZoomGuard } from './app/pageZoomGuard';
import './styles/global.css';

/** מפעיל את התוכנה הראשית (לא במסך המקרן) */
export function startApp(): void {
  setLocale('he');

  const repo = createWebLessonRepository();
  const assets = new AssetCache(repo);
  // תמונות על הלוח נטענות מהמטמון של השיעור (גם בציור וגם בייצוא)
  setObjectImageSource(assets);
  const board = createBoardStore(createWebSettingsStorage('default', 'tools'));
  const lessons = createLessonController({
    repo,
    board,
    defaultTitle: t('lesson.untitled'),
    defaultFolderName: t('folder.untitled'),
    copyTitle: (title) => t('lesson.copyOf', { title }),
    thumbnail: async (doc) => {
      await assets.preparePages([doc.pages[0]!], 1);
      await prepareMath([doc.pages[0]!]);
      return thumbnailDataUrl(doc.pages[0]!, assets);
    },
  });
  const runtime: AppRuntime = {
    app: createAppStore(createWebSettingsStorage()),
    board,
    lessons,
    repo,
    assets,
    teaching: createTeachingStore(),
    engine: null,
  };

  // מבקשים מהדפדפן לא למחוק את הנתונים המקומיים כשהדיסק מתמלא; מצב התקנה ואינטרנט.
  installPwaListeners();
  // מסך מקרן (אם נפתח): משדרים אליו את הלוח
  installTeacherSync(runtime);
  installPageZoomGuard();
  void requestPersistence();

  // מסך הפתיחה (לפי ההגדרה). בבדיקות אוטומטיות הוא לא מוצג, אלא אם מבקשים ‎?start=1.
  {
    const params = new URLSearchParams(location.search);
    const automated = navigator.webdriver === true;
    if (
      params.get('start') === '1' ||
      (runtime.app.getState().settings.showStartScreen && !automated)
    )
      runtime.app.getState().setStartScreen(true);
  }

  // פתיחת השיעור האחרון (או יצירת שיעור ראשון).
  void lessons.getState().init();
  lessons.subscribe((s, prev) => {
    if (s.error !== prev.error && s.error?.startsWith('corrupted:')) {
      runtime.app.getState().notify('error', t('save.corrupted', { title: s.error.slice(10) }));
    }
  });

  // שמירה מיידית כשהחלון נסגר, מוסתר או עובר לרקע.
  const flush = () => void lessons.getState().flush();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
  window.addEventListener('pagehide', flush);

  // פתיחת קבצים מ-Windows ("פתח באמצעות TeachBoard") – כשהתוכנה מותקנת
  handleLaunchedFiles(runtime);
  // מחילים את המראה לפני הציור הראשון, כדי שלא יהיה "הבהוב" של מצב בהיר.
  applyTheme(runtime.app.getState().settings.theme);

  const root = document.getElementById('root');
  if (!root) throw new Error('Root element #root not found');

  createRoot(root).render(
    <StrictMode>
      <RuntimeContext.Provider value={runtime}>
        <ErrorBoundary
          fallback={() => (
            <div className="tb-error-screen" role="alert">
              <p>{t('error.app')}</p>
              <button
                type="button"
                className="tb-btn tb-btn-primary"
                onClick={() => location.reload()}
              >
                {t('error.reload')}
              </button>
            </div>
          )}
        >
          <App />
        </ErrorBoundary>
        {!isDesktopApp() && <UpdatePrompt />}
      </RuntimeContext.Provider>
    </StrictMode>,
  );
}

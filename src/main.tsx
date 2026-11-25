import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/heebo';
import { App } from './app/App';
import { createAppStore } from './app/store';
import { RuntimeContext } from './app/StoreContext';
import type { AppRuntime } from './app/runtime';
import { createBoardStore } from './features/board/boardStore';
import { applyTheme } from './app/theme';
import { setLocale } from './i18n';
import { createWebSettingsStorage } from './platform/web/settingsStorage';
import { UpdatePrompt } from './ui/UpdatePrompt';
import './styles/global.css';

setLocale('he');

const runtime: AppRuntime = {
  app: createAppStore(createWebSettingsStorage()),
  board: createBoardStore(createWebSettingsStorage('default', 'tools')),
  engine: null,
};
// מחילים את המראה לפני הציור הראשון, כדי שלא יהיה "הבהוב" של מצב בהיר.
applyTheme(runtime.app.getState().settings.theme);

const root = document.getElementById('root');
if (!root) throw new Error('Root element #root not found');

createRoot(root).render(
  <StrictMode>
    <RuntimeContext.Provider value={runtime}>
      <App />
      <UpdatePrompt />
    </RuntimeContext.Provider>
  </StrictMode>,
);

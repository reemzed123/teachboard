import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/heebo';
import { App } from './app/App';
import { createAppStore } from './app/store';
import { StoreContext } from './app/StoreContext';
import { applyTheme } from './app/theme';
import { setLocale } from './i18n';
import { createWebSettingsStorage } from './platform/web/settingsStorage';
import { UpdatePrompt } from './ui/UpdatePrompt';
import './styles/global.css';

setLocale('he');

const store = createAppStore(createWebSettingsStorage());
// מחילים את המראה לפני הציור הראשון, כדי שלא יהיה "הבהוב" של מצב בהיר.
applyTheme(store.getState().settings.theme);

const root = document.getElementById('root');
if (!root) throw new Error('Root element #root not found');

createRoot(root).render(
  <StrictMode>
    <StoreContext.Provider value={store}>
      <App />
      <UpdatePrompt />
    </StoreContext.Provider>
  </StrictMode>,
);

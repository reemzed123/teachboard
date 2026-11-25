import { t } from '../i18n';
import './App.css';

export function App() {
  return (
    <main className="tb-placeholder">
      <h1>{t('app.name')}</h1>
      <p>{t('app.tagline')}</p>
      <p className="tb-muted">{t('app.buildStage')}</p>
    </main>
  );
}

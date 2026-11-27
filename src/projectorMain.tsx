import '@fontsource-variable/heebo';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { setLocale } from './i18n';
import { ProjectorApp } from './ui/ProjectorApp';
import './styles/global.css';

// מסך המקרן: רק הלוח, בלי שמירה ובלי עריכה.
setLocale('he');
document.title = 'TeachBoard – מקרן';
const root = document.getElementById('root');
if (root)
  createRoot(root).render(
    <StrictMode>
      <ProjectorApp />
    </StrictMode>,
  );

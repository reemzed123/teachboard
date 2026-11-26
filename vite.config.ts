import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// כל המשאבים נארזים מקומית – אין טעינה מ-CDN (דרישת עבודה אופליין).
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // לא מעדכנים אוטומטית באמצע שיעור – המורה מאשר (UpdatePrompt).
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'TeachBoard',
        short_name: 'TeachBoard',
        description: 'סביבת הוראה דיגיטלית למורים',
        lang: 'he',
        dir: 'rtl',
        start_url: './',
        scope: './',
        display: 'standalone',
        // "פתח באמצעות TeachBoard" ב-Windows, כשהתוכנה מותקנת
        file_handlers: [
          { action: './', accept: { 'application/x-teachboard': ['.board'] } },
          { action: './', accept: { 'application/pdf': ['.pdf'] } },
        ],
        launch_handler: { client_mode: 'focus-existing' },
        background_color: '#eef1f5',
        theme_color: '#2563eb',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // כל קובצי התוכנה, כולל הגופנים, נשמרים מראש במכשיר.
        globPatterns: [
          '**/*.{js,mjs,css,html,woff2,png,svg,webmanifest}',
          // מציג ה-PDF: גופנים, טבלאות תווים ופענוח תמונות – גם הם זמינים בלי אינטרנט
          'pdfjs/**/*.{pfb,ttf,bcmap,icc,wasm}',
        ],
        navigateFallback: 'index.html',
        // כל קובץ חייב להישמר במכשיר (ברירת המחדל 2MB עלולה לדלג בשקט על קובץ גדול)
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  base: './',
  build: { target: 'es2022', sourcemap: true },
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.{ts,tsx}'],
  },
});

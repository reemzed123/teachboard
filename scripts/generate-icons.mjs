// יוצר את קובצי הסמל (PNG) מתוך public/icon.svg. מריצים ידנית רק כשהסמל משתנה:
//   node scripts/generate-icons.mjs
import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const svg = await readFile('public/icon.svg', 'utf8');
const browser = await chromium.launch();
const page = await browser.newPage();

const targets = [
  { file: 'public/pwa-192.png', size: 192, padding: 0 },
  { file: 'public/pwa-512.png', size: 512, padding: 0 },
  // "maskable": Windows/Android עשויים לחתוך את הפינות, לכן הסמל מוקטן במרכז.
  { file: 'public/pwa-maskable-512.png', size: 512, padding: 0.12, bg: '#2563eb' },
  { file: 'public/apple-touch-icon.png', size: 180, padding: 0 },
];

for (const { file, size, padding, bg } of targets) {
  await page.setViewportSize({ width: size, height: size });
  const inner = Math.round(size * (1 - padding * 2));
  await page.setContent(
    `<body style="margin:0;display:grid;place-items:center;width:${size}px;height:${size}px;background:${bg ?? 'transparent'}">
       <div style="width:${inner}px;height:${inner}px">${svg.replace('<svg ', `<svg width="${inner}" height="${inner}" `)}</div>
     </body>`,
  );
  await page.screenshot({ path: file, omitBackground: !bg });
  console.log('נוצר', file);
}
await browser.close();

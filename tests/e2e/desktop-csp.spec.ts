/* eslint-disable @typescript-eslint/no-explicit-any -- גישה לכלי הבדיקה window.__tb בתוך הדפדפן */
import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { PDFDocument, StandardFonts } from 'pdf-lib';

// תוכנת Windows רצה עם מדיניות אבטחה מחמירה (CSP) שמוגדרת ב-src-tauri/tauri.conf.json.
// כאן מריצים את התוכנה בדפדפן עם אותה מדיניות בדיוק, ובודקים שהיכולות המרכזיות עובדות
// ושאין שום חסימה.

test('the app works under the desktop security policy (formulas, graphs, geometry, PDF)', async ({
  page,
}) => {
  const conf = JSON.parse(await readFile('src-tauri/tauri.conf.json', 'utf8'));
  const csp: string = conf.app.security.csp;
  await page.route('**/*', async (route) => {
    const req = route.request();
    if (req.resourceType() !== 'document') return route.continue();
    const res = await route.fetch();
    await route.fulfill({
      response: res,
      headers: { ...res.headers(), 'content-security-policy': csp },
    });
  });
  const violations: string[] = [];
  await page.exposeFunction('__cspViolation', (v: string) => violations.push(v));
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) =>
      (window as any).__cspViolation(`${e.violatedDirective} ${e.blockedURI}`),
    );
  });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/?debug=1');
  await expect(page.getByTestId('save-status')).toHaveAttribute('data-status', 'saved');
  const box = (await page.getByTestId('board').boundingBox())!;

  // נוסחה
  await page.getByRole('button', { name: 'מתמטיקה' }).click();
  await page.getByRole('button', { name: 'נוסחה חדשה' }).click();
  const field = page.getByTestId('formula-field');
  await field.waitFor();
  await page.waitForTimeout(150);
  await field.click();
  await page.keyboard.type('x^2+1');
  await page.getByRole('button', { name: 'הוספה ללוח' }).click();
  await expect(page.getByTestId('board')).toHaveAttribute('data-object-count', '1');

  // גיאומטריה
  await page.getByRole('button', { name: 'גיאומטריה' }).click();
  await page.locator('[data-geo-tool="segment"]').click();
  await page.mouse.click(box.x + 150, box.y + 420);
  await page.mouse.click(box.x + 350, box.y + 420);
  await expect(page.getByTestId('board')).toHaveAttribute('data-object-count', '2');

  // PDF
  const doc = await PDFDocument.create();
  doc.addPage([400, 300]).drawText('CSP', { font: await doc.embedFont(StandardFonts.Helvetica) });
  await page.getByRole('button', { name: 'PDF ומסמכים' }).click();
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('button', { name: 'פתיחת PDF כשיעור חדש' }).click(),
  ]);
  await chooser.setFiles({
    name: 'c.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(await doc.save()),
  });
  await expect(page.getByTestId('notice')).toContainText('נפתח');
  // העמוד מצויר בפועל (נבדק דרך מטמון הציור)
  await expect
    .poll(() =>
      page.evaluate(() => {
        const s = (window as any).__tb.runtime.board.getState();
        return s.doc.pages[0].background.pdf ? 'pdf' : 'none';
      }),
    )
    .toBe('pdf');
  await page.waitForTimeout(800);

  expect(violations).toEqual([]);
  expect(errors).toEqual([]);
});

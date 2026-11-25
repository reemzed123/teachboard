import { expect, test } from '@playwright/test';

// התוכנה בתוך מסגרת של אתר אחר (כמו בתצוגה המקדימה ב-claude.ai).
// באג שתוקן: יצירת נוסחה "העלימה" את כל התוכנה, כי MathLive זורק שגיאה בתוך מסגרת.

test('formula editor works when the app is embedded in another site', async ({ page, baseURL }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setContent(
    `<iframe id="app" src="${baseURL}/" style="width:1200px;height:760px;border:0"></iframe>`,
  );
  const app = page.frameLocator('#app');
  await expect(app.getByTestId('save-status')).toHaveAttribute('data-status', 'saved');
  await app.getByRole('button', { name: 'מתמטיקה' }).click();
  await app.getByRole('button', { name: 'נוסחה חדשה' }).click();
  const field = app.getByTestId('formula-field');
  await field.waitFor();
  await page.waitForTimeout(200);
  await field.click();
  await page.keyboard.type('x^2');
  await app.getByRole('button', { name: 'הוספה ללוח' }).click();
  // התוכנה עדיין מוצגת, והנוסחה נוספה
  await expect(app.getByTestId('board')).toHaveAttribute('data-object-count', '1');
  await expect(app.getByRole('navigation', { name: 'קטגוריות כלים' })).toBeVisible();
  expect(errors).toEqual([]);
});

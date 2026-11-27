/* eslint-disable @typescript-eslint/no-explicit-any -- גישה לכלי הבדיקה window.__tb בתוך הדפדפן */
import { expect, test } from '@playwright/test';

// מסך הפתיחה (בבדיקות הוא נפתח רק עם ‎?start=1).

test('start screen: new grid board, recent lessons, home button, creator details, setting', async ({
  page,
}) => {
  await page.goto('/?debug=1&start=1');
  const start = page.getByTestId('start-screen');
  await expect(start).toBeVisible();
  await expect(page.getByTestId('start-creator')).toContainText('reemzedek@gmail.com');
  await expect(page.getByTestId('start-creator').getByRole('link')).toHaveAttribute(
    'href',
    'mailto:reemzedek@gmail.com',
  );

  // לוח משבצות חדש
  await start.locator('[data-start="grid"]').click();
  await expect(start).toHaveCount(0);
  const page0 = () =>
    page.evaluate(() => {
      const s = (window as any).__tb.runtime.board.getState();
      return { pattern: s.doc.pages[0].background.pattern, layout: s.doc.pages[0].layout };
    });
  await expect.poll(page0).toEqual({ pattern: 'grid', layout: 'bounded' });
  await expect(page.getByTestId('save-status')).toHaveAttribute('data-status', 'saved');

  // כפתור "מסך הפתיחה" בסרגל העליון; השיעור מופיע באחרונים
  await page.locator('[data-action="home"]').click();
  await expect(start).toBeVisible();
  await expect(start.locator('.tb-start-lesson')).not.toHaveCount(0);
  await page.getByTestId('start-continue').click();
  await expect(start).toHaveCount(0);

  // לוח אינסופי; Escape סוגר
  await page.locator('[data-action="home"]').click();
  await start.locator('[data-start="infinite"]').click();
  await expect.poll(page0).toEqual({ pattern: 'none', layout: 'infinite' });
  await page.locator('[data-action="home"]').click();
  await page.keyboard.press('Escape');
  await expect(start).toHaveCount(0);

  // ההגדרה "להציג בפתיחה" נשמרת
  await page.locator('[data-action="home"]').click();
  await start.getByLabel('להציג מסך זה בפתיחת התוכנה').uncheck();
  expect(
    await page.evaluate(() => (window as any).__tb.runtime.app.getState().settings.showStartScreen),
  ).toBe(false);
});

test('start screen: opening a recent lesson and a folder', async ({ page }) => {
  await page.goto('/?debug=1');
  await expect(page.getByTestId('save-status')).toHaveAttribute('data-status', 'saved');
  await page.evaluate(async () => {
    const rt = (window as any).__tb.runtime;
    await rt.lessons.getState().createFolder('Grade 7', null);
  });
  await page.getByLabel('שם השיעור').fill('Fractions');
  await page.getByLabel('שם השיעור').press('Enter');
  await page.locator('[data-action="home"]').click();
  const start = page.getByTestId('start-screen');
  await start.locator('[data-start="blank"]').click();
  await expect(page.getByLabel('שם השיעור')).not.toHaveValue('Fractions');
  await page.locator('[data-action="home"]').click();
  await start.locator('.tb-start-lesson', { hasText: 'Fractions' }).click();
  await expect(page.getByLabel('שם השיעור')).toHaveValue('Fractions');

  // תיקייה: נפתחת חלונית השיעורים בתוך התיקייה
  await page.locator('[data-action="home"]').click();
  await start.getByRole('button', { name: 'Grade 7' }).click();
  await expect(start).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'מיקום' })).toContainText('Grade 7');
});

import { expect, test } from '@playwright/test';

// הבדיקה החשובה: אחרי טעינה ראשונה, התוכנה נפתחת ופועלת בלי אינטרנט בכלל.
test('works fully offline after the first visit', async ({ page, context }) => {
  await page.goto('/');
  // מחכים שה-Service Worker יסיים לשמור את כל קובצי התוכנה במכשיר.
  const state = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    const sw = reg.active!;
    if (sw.state !== 'activated') {
      await new Promise<void>((resolve) =>
        sw.addEventListener('statechange', () => sw.state === 'activated' && resolve()),
      );
    }
    return sw.state;
  });
  expect(state).toBe('activated');

  await context.setOffline(true);
  await page.reload();

  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('navigation', { name: 'קטגוריות כלים' })).toBeVisible();
  await page.getByRole('button', { name: 'הגדרות' }).click();
  await expect(page.getByRole('complementary', { name: 'הגדרות' })).toBeVisible();
  const fontOk = await page.evaluate(async () => {
    await document.fonts.load('16px "Heebo Variable"', 'שלום');
    return document.fonts.check('16px "Heebo Variable"', 'שלום');
  });
  expect(fontOk).toBe(true);

  // ציור ושמירה בלי אינטרנט – והתוכן נשאר אחרי רענון
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('save-status')).toHaveAttribute('data-status', 'saved');
  const box = (await page.getByTestId('board').boundingBox())!;
  await page.mouse.move(box.x + 100, box.y + 200);
  await page.mouse.down();
  await page.mouse.move(box.x + 300, box.y + 240, { steps: 5 });
  await page.mouse.up();
  await expect(page.getByTestId('save-status')).toHaveAttribute('data-status', 'saved');
  await page.reload();
  await expect(page.getByTestId('board')).toHaveAttribute('data-object-count', '1');

  // עורך הנוסחאות ושרטוט נוסחה – גם בלי אינטרנט
  await page.getByRole('button', { name: 'מתמטיקה' }).click();
  await page.getByRole('button', { name: 'נוסחה חדשה' }).click();
  const field = page.getByTestId('formula-field');
  await field.waitFor();
  await page.waitForTimeout(150);
  await field.click();
  await page.keyboard.type('x^2');
  await page.getByRole('button', { name: 'הוספה ללוח' }).click();
  await expect(page.getByTestId('board')).toHaveAttribute('data-object-count', '2');

  // גיאומטריה – מנוע החישוב נטען מהמחשב, בלי אינטרנט
  await page.getByRole('button', { name: 'גיאומטריה' }).click();
  await page.locator('[data-geo-tool="segment"]').click();
  await page.mouse.click(box.x + 150, box.y + 420);
  await page.mouse.click(box.x + 350, box.y + 420);
  await expect(page.getByTestId('board')).toHaveAttribute('data-object-count', '3');

  await context.setOffline(false);
});

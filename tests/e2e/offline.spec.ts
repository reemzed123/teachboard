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
    await document.fonts.ready;
    return document.fonts.check('16px "Heebo Variable"', 'שלום');
  });
  expect(fontOk).toBe(true);

  await context.setOffline(false);
});

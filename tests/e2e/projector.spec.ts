/* eslint-disable @typescript-eslint/no-explicit-any -- גישה לכלי הבדיקה window.__tb בתוך הדפדפן */
import { expect, test } from '@playwright/test';

// מסך מקרן: חלון נוסף שמראה רק את הלוח ועוקב אחרי המורה.

test('the projector window follows the teacher: writing (live), pages, teaching tools', async ({
  page,
  context,
}) => {
  await page.goto('/?debug=1');
  await expect(page.getByTestId('save-status')).toHaveAttribute('data-status', 'saved');

  // כפתור "מסך מקרן" פותח חלון
  await page.getByRole('button', { name: 'כלי הוראה' }).click();
  const [projector] = await Promise.all([
    context.waitForEvent('page'),
    page.locator('[data-action="projector.open"]').click(),
  ]);
  await projector.waitForLoadState();
  const pBoard = projector.getByTestId('board');
  await expect(projector.getByTestId('projector')).toHaveAttribute('data-connected', 'true');
  // אין סרגלים או חלוניות במקרן
  await expect(projector.getByRole('navigation')).toHaveCount(0);

  // כתיבה: נראית במקרן כבר בזמן הכתיבה, ונשמרת בסוף
  const box = (await page.getByTestId('board').boundingBox())!;
  await page.mouse.move(box.x + 150, box.y + 300);
  await page.mouse.down();
  await page.mouse.move(box.x + 350, box.y + 330, { steps: 10 });
  await expect(pBoard).toHaveAttribute('data-live', 'on');
  await page.mouse.up();
  await expect(pBoard).toHaveAttribute('data-object-count', '1');
  await expect(pBoard).toHaveAttribute('data-live', 'off');

  // עמוד חדש – המקרן עובר איתו
  await page.locator('[data-action="page.add"]').click();
  const pageId = await page.evaluate(() => (window as any).__tb.runtime.board.getState().pageId);
  await expect(pBoard).toHaveAttribute('data-page-id', pageId);
  await expect(pBoard).toHaveAttribute('data-object-count', '0');

  // טיימר וזרקור מופיעים גם במקרן
  await page.evaluate(() => {
    const t = (window as any).__tb.runtime.teaching.getState();
    t.openClock('timer');
    t.toggleSpotlight(true);
  });
  await expect(projector.locator('.tb-projector-clock')).toBeVisible();
  await expect(projector.locator('.tb-spotlight')).toBeVisible();
});

test('the projector waits politely when the main app is not open', async ({ page }) => {
  await page.goto('/?view=projector');
  await expect(page.getByTestId('projector')).toBeVisible();
  await expect(page.getByText('ממתין לתוכנה הראשית')).toBeVisible();
});

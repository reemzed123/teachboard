/* eslint-disable @typescript-eslint/no-explicit-any -- גישה לכלי הבדיקה window.__tb בתוך הדפדפן */
import { expect, test, type Page } from '@playwright/test';

// זום בשתי אצבעות: במסך מגע (צביטה) ובמשטח מגע של מחשב נייד (מגיע ללוח כ-Ctrl+גלגלת).

const scale = (page: Page) =>
  page.evaluate(() => (window as any).__tb.runtime.board.getState().view.scale as number);

test.beforeEach(async ({ page }) => {
  await page.goto('/?debug=1');
  await expect(page.getByTestId('save-status')).toHaveAttribute('data-status', 'saved');
});

test('touch screen: two-finger pinch zooms the board', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium');
  const box = (await page.getByTestId('board').boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const cdp = await page.context().newCDPSession(page);
  const before = await scale(page);
  const touch = async (type: 'touchStart' | 'touchMove' | 'touchEnd', d: number) =>
    cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints:
        type === 'touchEnd'
          ? []
          : [
              { x: cx - d, y: cy, id: 1 },
              { x: cx + d, y: cy, id: 2 },
            ],
    });
  await touch('touchStart', 40);
  for (let d = 50; d <= 160; d += 10) await touch('touchMove', d);
  await touch('touchEnd', 0);
  await expect.poll(() => scale(page)).toBeGreaterThan(before * 2.5);
  // לא נוצר קו מהאצבעות
  await expect(page.getByTestId('board')).toHaveAttribute('data-object-count', '0');
});

test('touch screen: pinch also works after a pen was used (palm mode)', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium');
  await page.evaluate(() => (window as any).__tb.runtime.board.getState().markPen(true));
  const box = (await page.getByTestId('board').boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const cdp = await page.context().newCDPSession(page);
  const before = await scale(page);
  const pts = (d: number) => [
    { x: cx - d, y: cy, id: 1 },
    { x: cx + d, y: cy, id: 2 },
  ];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pts(150) });
  for (let d = 140; d >= 50; d -= 10)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pts(d) });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect.poll(() => scale(page)).toBeLessThan(before * 0.6);
});

test('touchpad pinch (Ctrl + wheel) zooms the board, not the whole page', async ({ page }) => {
  const box = (await page.getByTestId('board').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  const before = await scale(page);
  await page.keyboard.down('Control');
  for (let i = 0; i < 10; i++) await page.mouse.wheel(0, -40);
  await page.keyboard.up('Control');
  await expect.poll(() => scale(page)).toBeGreaterThan(before * 1.5);
  // הדף עצמו לא הוגדל
  expect(await page.evaluate(() => window.visualViewport?.scale ?? 1)).toBe(1);
});

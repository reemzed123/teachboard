/* eslint-disable @typescript-eslint/no-explicit-any -- גישה לכלי הבדיקה window.__tb בתוך הדפדפן */
import { expect, test, type Page } from '@playwright/test';

// בדיקות שלב 7א: לייזר, זרקור, כיסוי וחשיפה, טיימר, שעון עצר, מצב הצגה.

const count = (page: Page) => page.getByTestId('board').getAttribute('data-object-count');

async function stroke(page: Page, y = 300) {
  const box = (await page.getByTestId('board').boundingBox())!;
  await page.mouse.move(box.x + 150, box.y + y);
  await page.mouse.down();
  await page.mouse.move(box.x + 400, box.y + y + 40, { steps: 10 });
  await page.mouse.up();
}

async function teachingPanel(page: Page) {
  if (!(await page.getByRole('button', { name: 'זרקור', exact: true }).isVisible()))
    await page.getByRole('button', { name: 'כלי הוראה' }).click();
}

test.beforeEach(async ({ page }) => {
  await page.clock.install();
  await page.goto('/?debug=1');
  await expect(page.getByTestId('save-status')).toHaveAttribute('data-status', 'saved');
  await teachingPanel(page);
});

test('laser pointer draws a fading trail but adds nothing to the lesson', async ({ page }) => {
  await page.getByRole('button', { name: 'מצביע לייזר' }).click();
  await expect(page.getByTestId('board')).toHaveAttribute('data-tool', 'laser');
  await stroke(page);
  expect(await count(page)).toBe('0');
  expect(
    await page.evaluate(
      () => (window as any).__tb.runtime.board.getState().history.past?.length ?? 0,
    ),
  ).toBe(0);
});

test('spotlight darkens the board, writing still works through it, Esc closes it', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'זרקור', exact: true }).click();
  await expect(page.getByTestId('spotlight')).toBeVisible();
  await page.evaluate(() => (window as any).__tb.runtime.board.getState().setTool('pen'));
  await stroke(page);
  await expect.poll(() => count(page)).toBe('1');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('spotlight')).toHaveCount(0);
});

test('cover: drag the handle to reveal; covered area blocks writing; close button', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'כיסוי וחשיפה' }).click();
  const cover = page.getByTestId('cover');
  await expect(cover).toBeVisible();
  const board = (await page.getByTestId('board').boundingBox())!;
  const before = (await cover.boundingBox())!.height;
  expect(before / board.height).toBeGreaterThan(0.8);

  const h = (await page.getByTestId('cover-handle').boundingBox())!;
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
  await page.mouse.down();
  await page.mouse.move(h.x + h.width / 2, board.y + board.height * 0.3, { steps: 6 });
  await page.mouse.up();
  const after = (await cover.boundingBox())!.height;
  expect(after / board.height).toBeCloseTo(0.3, 1);

  // כתיבה בתוך האזור המכוסה לא עוברת ללוח
  await page.mouse.move(board.x + 150, board.y + 40);
  await page.mouse.down();
  await page.mouse.move(board.x + 350, board.y + 60, { steps: 5 });
  await page.mouse.up();
  expect(await count(page)).toBe('0');

  await page.getByRole('button', { name: 'הסרת הכיסוי' }).click();
  await expect(cover).toHaveCount(0);
});

test('timer: preset, start, pause, finishes with a clear message; stopwatch counts up', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'טיימר', exact: true }).click();
  const clock = page.getByTestId('clock');
  await expect(clock).toBeVisible();
  await clock.getByRole('button', { name: "1 דק'" }).click();
  await expect(page.getByTestId('clock-time')).toHaveText('1:00');
  await clock.getByRole('button', { name: 'התחלה' }).click();
  await page.clock.fastForward(20_000);
  await expect(page.getByTestId('clock-time')).toHaveText('0:40');
  await clock.getByRole('button', { name: 'עצירה' }).click();
  await page.clock.fastForward(30_000);
  await expect(page.getByTestId('clock-time')).toHaveText('0:40');
  await clock.getByRole('button', { name: 'התחלה' }).click();
  await page.clock.fastForward(41_000);
  await expect(page.getByTestId('clock-time')).toHaveText('הזמן נגמר!');
  await expect(clock).toHaveAttribute('data-finished', 'true');
  await clock.getByRole('button', { name: 'איפוס' }).click();
  await expect(page.getByTestId('clock-time')).toHaveText('1:00');

  await teachingPanel(page);
  await page.getByRole('button', { name: 'שעון עצר' }).click();
  await clock.getByRole('button', { name: 'התחלה' }).click();
  await page.clock.fastForward(75_000);
  await expect(page.getByTestId('clock-time')).toHaveText('1:15');
  await clock.getByRole('button', { name: 'סגירה' }).click();
  await expect(clock).toHaveCount(0);
});

test('presentation mode hides the toolbars; the timer stays visible', async ({ page }) => {
  await page.getByRole('button', { name: 'טיימר', exact: true }).click();
  await page.getByRole('button', { name: 'מצב הצגה' }).click();
  await expect(page.getByRole('button', { name: 'כלי הוראה' })).toHaveCount(0);
  await expect(page.getByTestId('clock')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'כלי הוראה' })).toBeVisible();
});

test('PDF category has its own working panel', async ({ page }) => {
  await page.getByRole('button', { name: 'PDF ומסמכים' }).click();
  await expect(page.getByRole('button', { name: 'פתיחת PDF כשיעור חדש' })).toBeVisible();
  await expect(page.getByText('מתוכננים לשלב')).toHaveCount(0);
});

/* eslint-disable @typescript-eslint/no-explicit-any -- גישה לכלי הבדיקה window.__tb בתוך הדפדפן */
import { expect, test } from '@playwright/test';

// סרגל, מחוגה ומשולש וירטואליים.

test.beforeEach(async ({ page }) => {
  await page.goto('/?debug=1');
  await expect(page.getByTestId('save-status')).toHaveAttribute('data-status', 'saved');
  await page.evaluate(() =>
    (window as any).__tb.runtime.board.getState().setView({ x: 0, y: 0, scale: 1 }),
  );
});

const objects = (page: any) =>
  page.evaluate(() => (window as any).__tb.runtime.board.getState().doc.pages[0].objects);

test('ruler: a shaky pen stroke next to the edge becomes a straight line along it', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'ציור וכתיבה' }).click();
  await page.locator('[data-instrument-toggle="instr.ruler"]').click();
  await expect(page.locator('[data-instrument="ruler"]')).toBeVisible();
  await page.evaluate(() =>
    (window as any).__tb.runtime.board
      .getState()
      .setInstruments(() => ({ ruler: { x: 400, y: 300, angle: 0 } })),
  );
  const box = (await page.getByTestId('board').boundingBox())!;
  // הקצה העליון של הסרגל: y = 300 - 32
  await page.mouse.move(box.x + 250, box.y + 262);
  await page.mouse.down();
  for (let i = 1; i <= 20; i++)
    await page.mouse.move(box.x + 250 + i * 12, box.y + 262 + Math.sin(i) * 5);
  await page.mouse.up();
  await expect.poll(async () => (await objects(page)).length).toBe(1);
  const [ink] = await objects(page);
  const ys = ink.points
    .filter((_: number, i: number) => i % 3 === 1)
    .map((v: number) => v + ink.transform.y);
  expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(0.5);
  expect(ys[0]).toBeCloseTo(268, 0);

  // × מסיר את הסרגל
  await page.locator('[data-instrument-close="ruler"]').click();
  await expect(page.getByTestId('instruments')).toHaveCount(0);
});

test('compass: turning the knob draws an arc in the pen color (one undo step)', async ({
  page,
}) => {
  await page.evaluate(() => {
    const s = (window as any).__tb.runtime.board.getState();
    s.updatePrefs((p: any) => ({ ...p, pen: { ...p.pen, color: '#dc2626' } }));
    s.setInstruments(() => ({ compass: { cx: 400, cy: 300, r: 100, angle: 0 } }));
  });
  const box = (await page.getByTestId('board').boundingBox())!;
  const knob = (await page.locator('[data-compass="knob"]').boundingBox())!;
  await page.mouse.move(knob.x + knob.width / 2, knob.y + knob.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 36; i++) {
    const a = (i * 10 * Math.PI) / 180;
    await page.mouse.move(box.x + 400 + 130 * Math.cos(a), box.y + 300 + 130 * Math.sin(a));
  }
  await page.mouse.up();
  await expect.poll(async () => (await objects(page)).length).toBe(1);
  const [ink] = await objects(page);
  expect(ink.style.color).toBe('#dc2626');
  // כל הנקודות על מעגל ברדיוס 100 סביב (400, 300)
  const ok = await page.evaluate((o: any) => {
    for (let i = 0; i < o.points.length; i += 3) {
      const d = Math.hypot(
        o.points[i] + o.transform.x - 400,
        o.points[i + 1] + o.transform.y - 300,
      );
      if (Math.abs(d - 100) > 0.5) return false;
    }
    return true;
  }, ink);
  expect(ok).toBe(true);
  await page.keyboard.press('Control+z');
  await expect.poll(async () => (await objects(page)).length).toBe(0);
});

test('set square: switching between 45° and 30°/60°, rotating with the handle', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'ציור וכתיבה' }).click();
  await page.locator('[data-instrument-toggle="instr.setSquare45"]').click();
  const kind = () =>
    page.evaluate(() => (window as any).__tb.runtime.board.getState().instruments.setSquare?.kind);
  expect(await kind()).toBe('45');
  await page.locator('[data-instrument-toggle="instr.setSquare60"]').click();
  expect(await kind()).toBe('60');
  const handle = (await page.locator('[data-instrument-rotate="setSquare"]').boundingBox())!;
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(handle.x - 60, handle.y + 10, { steps: 6 });
  await page.mouse.up();
  const angle = await page.evaluate(
    () => (window as any).__tb.runtime.board.getState().instruments.setSquare.angle,
  );
  expect(angle).not.toBe(0);
});

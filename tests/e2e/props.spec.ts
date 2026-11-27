/* eslint-disable @typescript-eslint/no-explicit-any -- גישה לכלי הבדיקה window.__tb בתוך הדפדפן */
import { expect, test } from '@playwright/test';

test('math props: number line (editable), fraction bars, hundred chart', async ({ page }) => {
  await page.goto('/?debug=1');
  await expect(page.getByTestId('save-status')).toHaveAttribute('data-status', 'saved');
  await page.evaluate(() => (window as any).__tb.runtime.app.getState().setAutoClosePanel(false));
  await page.getByRole('button', { name: 'מתמטיקה' }).click();
  const props = page.getByTestId('math-props');
  const objects = () =>
    page.evaluate(() => {
      const s = (window as any).__tb.runtime.board.getState();
      return s.doc.pages[0].objects.map((o: any) => ({
        type: o.type,
        from: o.from,
        to: o.to,
        step: o.step,
      }));
    });

  await props.locator('[data-prop="numberline"]').click();
  await expect(page.getByTestId('numberline-editor')).toBeVisible();
  await page.locator('[data-numberline="from"]').fill('0');
  await page.locator('[data-numberline="from"]').press('Enter');
  await page.locator('[data-numberline="to"]').fill('1');
  await page.locator('[data-numberline="to"]').press('Enter');
  await page.locator('[data-numberline="step"]').fill('0.1');
  await page.locator('[data-numberline="step"]').press('Enter');
  expect((await objects())[0]).toEqual({ type: 'numberline', from: 0, to: 1, step: 0.1 });

  await props.locator('[data-prop="fractions"]').click();
  await page.getByTestId('fractions-editor').locator('[data-denominator="5"]').check();
  const den = await page.evaluate(
    () => (window as any).__tb.runtime.board.getState().doc.pages[0].objects[1].denominators,
  );
  expect(den).toContain(5);

  await props.locator('[data-prop="hundred"]').click();
  expect((await objects()).map((o: any) => o.type)).toEqual(['numberline', 'fractions', 'table']);
  // ביטול מחזיר אחורה
  await page.keyboard.press('Control+z');
  expect((await objects()).length).toBe(2);
});

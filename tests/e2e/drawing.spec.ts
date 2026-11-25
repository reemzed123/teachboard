/* eslint-disable @typescript-eslint/no-explicit-any -- גישה לכלי הבדיקה window.__tb בתוך הדפדפן */
import { expect, test, type Page } from '@playwright/test';

// בדיקות מנוע הציור בדפדפן אמיתי.
// ‎?debug=1 חושף את מצב הלוח לבדיקה (window.__tb) – לא בשימוש רגיל.

type Pt = [number, number];

async function boardBox(page: Page) {
  const box = await page.getByTestId('board').boundingBox();
  if (!box) throw new Error('board not visible');
  return box;
}

async function drawMouse(page: Page, pts: Pt[]) {
  const box = await boardBox(page);
  await page.mouse.move(box.x + pts[0]![0], box.y + pts[0]![1]);
  await page.mouse.down();
  for (const [x, y] of pts.slice(1)) await page.mouse.move(box.x + x, box.y + y, { steps: 4 });
  await page.mouse.up();
}

const wave = (x0: number, y0: number): Pt[] =>
  Array.from({ length: 20 }, (_, i) => [x0 + i * 12, y0 + Math.sin(i / 3) * 25] as Pt);

/** שולח אירועי עט/מגע סינתטיים (Playwright לא מדמה לחץ עט). */
async function dispatchPointer(
  page: Page,
  type: 'pointerdown' | 'pointermove' | 'pointerup',
  x: number,
  y: number,
  opts: {
    pointerType: 'pen' | 'touch';
    pressure?: number;
    buttons?: number;
    button?: number;
    pointerId?: number;
  },
) {
  await page.evaluate(
    ({ type, x, y, opts }) => {
      const board = document.querySelector('[data-testid=board]')!;
      const r = board.getBoundingClientRect();
      board.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          cancelable: true,
          clientX: r.left + x,
          clientY: r.top + y,
          pointerId: opts.pointerId ?? 7,
          pointerType: opts.pointerType,
          pressure: opts.pressure ?? (type === 'pointerup' ? 0 : 0.5),
          buttons: opts.buttons ?? (type === 'pointerup' ? 0 : 1),
          button: opts.button ?? (type === 'pointermove' ? -1 : 0),
          isPrimary: true,
        }),
      );
    },
    { type, x, y, opts },
  );
}

const count = (page: Page) => page.getByTestId('board').getAttribute('data-object-count');

function objects(page: Page) {
  return page.evaluate(() => {
    const s = (window as any).__tb.runtime.board.getState();
    return s.doc.pages[0].objects as {
      id: string;
      pressure: boolean;
      transform: { x: number; y: number };
      points: number[];
    }[];
  });
}

test.beforeEach(async ({ page }) => {
  await page.goto('/?debug=1');
});

test('draws with the mouse; undo and redo with buttons and keyboard', async ({ page }) => {
  await drawMouse(page, wave(60, 100));
  await drawMouse(page, wave(60, 200));
  await expect.poll(() => count(page)).toBe('2');

  await page.locator('.tb-history [data-action="edit.undo"]').click();
  await expect.poll(() => count(page)).toBe('1');
  await page.keyboard.press('Control+z');
  await expect.poll(() => count(page)).toBe('0');
  await expect(page.locator('.tb-history [data-action="edit.undo"]')).toBeDisabled();
  await page.keyboard.press('Control+y');
  await page.locator('.tb-history [data-action="edit.redo"]').click();
  await expect.poll(() => count(page)).toBe('2');
});

test('pen pressure is recorded and reported', async ({ page }) => {
  await page.getByRole('button', { name: 'ציור וכתיבה' }).click();
  await expect(page.getByTestId('pressure-status')).toHaveText(/לא זוהה עט/);
  await dispatchPointer(page, 'pointerdown', 100, 100, { pointerType: 'pen', pressure: 0.2 });
  for (let i = 1; i <= 10; i++) {
    await dispatchPointer(page, 'pointermove', 100 + i * 15, 100, {
      pointerType: 'pen',
      pressure: 0.2 + i * 0.07,
    });
  }
  await dispatchPointer(page, 'pointerup', 250, 100, { pointerType: 'pen' });
  await expect.poll(() => count(page)).toBe('1');
  const [obj] = await objects(page);
  expect(obj!.pressure).toBe(true);
  const pressures = obj!.points.filter((_, i) => i % 3 === 2);
  expect(Math.max(...pressures) - Math.min(...pressures)).toBeGreaterThan(0.3);
  await expect(page.getByTestId('pressure-status')).toHaveText(/זוהה עט עם לחץ/);
});

test('pen without pressure (e.g. Windows Ink off) still draws, with fixed width', async ({
  page,
}) => {
  await dispatchPointer(page, 'pointerdown', 100, 100, { pointerType: 'pen', pressure: 0.5 });
  for (let i = 1; i <= 5; i++)
    await dispatchPointer(page, 'pointermove', 100 + i * 20, 100, {
      pointerType: 'pen',
      pressure: 0.5,
    });
  await dispatchPointer(page, 'pointerup', 200, 100, { pointerType: 'pen' });
  const [obj] = await objects(page);
  expect(obj!.pressure).toBe(false);
});

test('pen eraser end erases', async ({ page }) => {
  await drawMouse(page, [
    [50, 150],
    [350, 150],
  ]);
  await expect.poll(() => count(page)).toBe('1');
  await dispatchPointer(page, 'pointerdown', 200, 150, {
    pointerType: 'pen',
    buttons: 32,
    button: 5,
  });
  await dispatchPointer(page, 'pointermove', 205, 152, { pointerType: 'pen', buttons: 32 });
  await dispatchPointer(page, 'pointerup', 205, 152, { pointerType: 'pen' });
  await expect.poll(() => count(page)).toBe('0');
});

test('stroke eraser removes whole strokes; area eraser cuts them', async ({ page }) => {
  await drawMouse(page, [
    [50, 100],
    [400, 100],
  ]);
  await drawMouse(page, [
    [50, 250],
    [400, 250],
  ]);
  await page.keyboard.press('e');
  await drawMouse(page, [
    [200, 90],
    [200, 110],
  ]);
  await expect.poll(() => count(page)).toBe('1');

  await page.getByRole('button', { name: 'ציור וכתיבה' }).click();
  await page.getByLabel('אזור (חותך קווים)').check();
  await drawMouse(page, [
    [220, 240],
    [220, 260],
  ]);
  await expect.poll(() => count(page)).toBe('2'); // הקו נחתך לשניים

  // ביטול אחד מחזיר את הקו השלם
  await page.keyboard.press('Control+z');
  await expect.poll(() => count(page)).toBe('1');
});

test('select by clicking, move by dragging, undo restores position', async ({ page }) => {
  await drawMouse(page, [
    [100, 100],
    [300, 100],
  ]);
  const before = (await objects(page))[0]!.transform;
  await page.keyboard.press('v');
  await drawMouse(page, [
    [200, 100],
    [260, 180],
  ]);
  const after = (await objects(page))[0]!.transform;
  expect(after.x - before.x).toBeCloseTo(60, 0);
  expect(after.y - before.y).toBeCloseTo(80, 0);
  await page.keyboard.press('Control+z');
  expect((await objects(page))[0]!.transform).toEqual(before);
});

test('rectangle selection and Delete', async ({ page }) => {
  await drawMouse(page, [
    [100, 100],
    [200, 100],
  ]);
  await drawMouse(page, [
    [100, 150],
    [200, 150],
  ]);
  await drawMouse(page, [
    [100, 400],
    [200, 400],
  ]);
  await page.keyboard.press('v');
  await drawMouse(page, [
    [60, 60],
    [250, 200],
  ]);
  await page.keyboard.press('Delete');
  await expect.poll(() => count(page)).toBe('1');
});

test('zoom with Ctrl+wheel and buttons; fit content', async ({ page }) => {
  const zoom = page.getByTestId('zoom-value');
  await expect(zoom).toHaveText('100%');
  const box = await boardBox(page);
  await page.mouse.move(box.x + 200, box.y + 200);
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, -300);
  await page.keyboard.up('Control');
  await expect(zoom).not.toHaveText('100%');
  await zoom.click();
  await expect(zoom).toHaveText('100%');
  await page.locator('.tb-zoom [data-action="view.zoomIn"]').click();
  await expect(zoom).toHaveText('125%');

  await drawMouse(page, [
    [100, 100],
    [140, 120],
  ]);
  await page.locator('.tb-zoom [data-action="view.zoomFit"]').click();
  await expect(zoom).toHaveText('200%'); // קו קטן מוגדל עד הגבול של 200%
});

test('after a pen is detected, one finger pans instead of drawing; two fingers zoom', async ({
  page,
}) => {
  // עט נוגע → מסומן "זוהה עט"
  await dispatchPointer(page, 'pointerdown', 50, 50, { pointerType: 'pen', pressure: 0.4 });
  await dispatchPointer(page, 'pointerup', 50, 50, { pointerType: 'pen' });
  const n = await count(page);

  await dispatchPointer(page, 'pointerdown', 300, 300, { pointerType: 'touch', pointerId: 21 });
  await dispatchPointer(page, 'pointermove', 340, 330, { pointerType: 'touch', pointerId: 21 });
  await dispatchPointer(page, 'pointerup', 340, 330, { pointerType: 'touch', pointerId: 21 });
  expect(await count(page)).toBe(n); // לא צויר קו מכף היד/אצבע
  const view = await page.evaluate(() => (window as any).__tb.runtime.board.getState().view);
  expect(view.x).toBeCloseTo(40, 0);
  expect(view.y).toBeCloseTo(30, 0);

  // צביטה בשתי אצבעות
  await dispatchPointer(page, 'pointerdown', 300, 300, { pointerType: 'touch', pointerId: 31 });
  await dispatchPointer(page, 'pointerdown', 400, 300, { pointerType: 'touch', pointerId: 32 });
  await dispatchPointer(page, 'pointermove', 450, 300, { pointerType: 'touch', pointerId: 32 });
  await dispatchPointer(page, 'pointerup', 450, 300, { pointerType: 'touch', pointerId: 32 });
  await dispatchPointer(page, 'pointerup', 300, 300, { pointerType: 'touch', pointerId: 31 });
  await expect(page.getByTestId('zoom-value')).toHaveText('150%');
});

test('clear page asks for confirmation and can be undone', async ({ page }) => {
  await drawMouse(page, wave(60, 100));
  await page.getByRole('button', { name: 'ציור וכתיבה' }).click();
  await page.getByRole('button', { name: 'ניקוי כל העמוד' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'ביטול' }).click();
  await expect.poll(() => count(page)).toBe('1');
  await page.getByRole('button', { name: 'ניקוי כל העמוד' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'ניקוי העמוד' }).click();
  await expect.poll(() => count(page)).toBe('0');
  await page.keyboard.press('Control+z');
  await expect.poll(() => count(page)).toBe('1');
});

test('tool color and width are remembered after reload', async ({ page }) => {
  await page.getByRole('button', { name: 'ציור וכתיבה' }).click();
  await page.getByRole('button', { name: 'צבע #dc2626' }).click();
  await page.getByRole('button', { name: 'גודל 8' }).click();
  await page.reload();
  await page.getByRole('button', { name: 'ציור וכתיבה' }).click();
  await expect(page.getByRole('button', { name: 'צבע #dc2626' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('button', { name: 'גודל 8' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('performance: 5,000 strokes on the board stay responsive', async ({ page }) => {
  const loadMs = await page.evaluate(() => (window as any).__tb.addSyntheticStrokes(5000));
  await expect.poll(() => count(page)).toBe('5000');

  // הוספת קו אחד כשיש 5,000 – ציור הקו החדש בלבד
  const appendMs = await page.evaluate(() => (window as any).__tb.addSyntheticStrokes(1));
  console.log(`5000 strokes: load ${loadMs.toFixed(0)}ms, append one ${appendMs.toFixed(1)}ms`);
  expect(appendMs).toBeLessThan(30);

  // כתיבה בעכבר עדיין עובדת ונשמרת
  await drawMouse(page, wave(60, 100));
  await expect.poll(() => count(page)).toBe('5002');
});

/* eslint-disable @typescript-eslint/no-explicit-any -- גישה לכלי הבדיקה window.__tb בתוך הדפדפן */
import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';

// בדיקות שלב 5: גיאומטריה דינמית.

async function click(page: Page, x: number, y: number) {
  const box = (await page.getByTestId('board').boundingBox())!;
  await page.mouse.click(box.x + x, box.y + y);
  await page.waitForTimeout(80);
}

async function drag(page: Page, x1: number, y1: number, x2: number, y2: number) {
  const box = (await page.getByTestId('board').boundingBox())!;
  await page.mouse.move(box.x + x1, box.y + y1);
  await page.mouse.down();
  await page.mouse.move(box.x + x2, box.y + y2, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(80);
}

const tool = (page: Page, id: string) => page.locator(`[data-geo-tool="${id}"]`).click();
const solution = (page: Page) => page.evaluate(() => (window as any).__tb.geoSolution());

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true });
  });
  await page.goto('/?debug=1');
  await expect(page.getByTestId('save-status')).toHaveAttribute('data-status', 'saved');
  await page.evaluate(() =>
    (window as any).__tb.runtime.board.getState().setView({ x: 0, y: 0, scale: 1 }),
  );
  await page.getByRole('button', { name: 'גיאומטריה' }).click();
});

async function triangle(page: Page) {
  await tool(page, 'polygon');
  await click(page, 150, 450);
  await click(page, 450, 450);
  await click(page, 250, 200);
  await click(page, 150, 450); // סגירה
}

test('triangle with a midpoint: dragging a vertex keeps the midpoint in the middle', async ({
  page,
}) => {
  await triangle(page);
  await tool(page, 'midpoint');
  await click(page, 300, 450); // הצלע AB
  let sol = await solution(page);
  expect(sol.D).toMatchObject({ kind: 'midpoint', t: 'pt' });
  expect(sol.D.x).toBeCloseTo(300, 0);

  await tool(page, 'move');
  await drag(page, 450, 450, 550, 400);
  sol = await solution(page);
  expect(sol.B.x).toBeCloseTo(550, 0);
  expect(sol.D.x).toBeCloseTo((sol.A.x + sol.B.x) / 2, 6);
  expect(sol.D.y).toBeCloseTo((sol.A.y + sol.B.y) / 2, 6);
});

test('perpendicular stays perpendicular after dragging; angle is measured as 90°', async ({
  page,
}) => {
  await tool(page, 'line');
  await click(page, 150, 400);
  await click(page, 450, 350);
  await tool(page, 'point');
  await click(page, 300, 200); // C
  await tool(page, 'altitude');
  await click(page, 300, 200);
  await click(page, 220, 388); // הישר AB
  await tool(page, 'move');
  await drag(page, 450, 350, 470, 250);
  const sol = await solution(page);
  const foot = Object.values(sol).find((s: any) => s.kind === 'foot') as any;
  const ang = Object.values(sol).find((s: any) => s.kind === 'angle') as any;
  expect(foot).toBeTruthy();
  expect(ang.deg).toBeCloseTo(90, 6);
  // העקב על הישר AB
  const { A, B } = sol;
  const cross = (B.x - A.x) * (foot.y - A.y) - (B.y - A.y) * (foot.x - A.x);
  expect(Math.abs(cross)).toBeLessThan(1e-6 * Math.hypot(B.x - A.x, B.y - A.y) * 100);
});

test('a point on a circle stays on the circle when dragged', async ({ page }) => {
  await tool(page, 'circle');
  await click(page, 300, 300); // מרכז A
  await click(page, 400, 300); // B על המעגל
  await tool(page, 'point');
  await click(page, 300, 200); // על המעגל → נקודה גולשת C
  let sol = await solution(page);
  expect(sol.C.kind).toBe('glider');
  await tool(page, 'move');
  await drag(page, 300, 200, 380, 120);
  sol = await solution(page);
  expect(Math.hypot(sol.C.x - 300, sol.C.y - 300)).toBeCloseTo(100, 3);
});

test('intersection of two circles, deleting a point removes what was built on it (undoable)', async ({
  page,
}) => {
  await tool(page, 'circle');
  await click(page, 250, 300);
  await click(page, 350, 300);
  await tool(page, 'circle');
  await click(page, 350, 300); // מרכז = B הקיימת
  await click(page, 250, 300); // דרך A
  await tool(page, 'intersection');
  await click(page, 250, 200); // המעגל הראשון (נקודה עליו)
  await click(page, 350, 200); // המעגל השני
  let sol = await solution(page);
  const inter = Object.values(sol).filter((s: any) => s.kind === 'intersection' && s.t === 'pt');
  expect(inter).toHaveLength(2);
  // משולש שווה צלעות: מרחק נקודת החיתוך מ-A ומ-B שווה לרדיוס
  const p = inter[0] as any;
  expect(Math.hypot(p.x - 250, p.y - 300)).toBeCloseTo(100, 4);

  await tool(page, 'delete');
  await click(page, 250, 300); // A
  sol = await solution(page);
  expect(Object.keys(sol)).toEqual(['B']);
  await page.keyboard.press('Control+z');
  sol = await solution(page);
  expect(Object.values(sol).filter((s: any) => s.kind === 'intersection')).toHaveLength(2);
});

test('element properties: equal-segment ticks, hide; construction saved and exported', async ({
  page,
}) => {
  await tool(page, 'segment');
  await click(page, 150, 300);
  await click(page, 400, 300);
  await tool(page, 'length');
  await click(page, 275, 300);
  await tool(page, 'move');
  await click(page, 220, 300);
  const inspector = page.getByTestId('geo-inspector');
  await expect(inspector).toContainText('קטע');
  await inspector.getByLabel('סימון קטעים שווים').selectOption('2');
  const ticks = await page.evaluate(
    () =>
      (window as any).__tb.runtime.board
        .getState()
        .doc.pages[0].objects[0].elements.find((e: any) => e.kind === 'segment').style.ticks,
  );
  expect(ticks).toBe(2);

  await expect(page.getByTestId('save-status')).toHaveAttribute('data-status', 'saved');
  await page.reload();
  await expect(page.getByTestId('save-status')).toHaveAttribute('data-status', 'saved');
  const sol = await solution(page);
  expect(sol.A.t).toBe('pt');

  await page.getByRole('button', { name: 'ניהול שיעורים וקבצים' }).click();
  const [pdf] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'PDF של העמוד' }).click(),
  ]);
  expect((await PDFDocument.load(await readFile((await pdf.path())!))).getPageCount()).toBe(1);
});

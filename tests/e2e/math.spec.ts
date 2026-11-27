/* eslint-disable @typescript-eslint/no-explicit-any -- גישה לכלי הבדיקה window.__tb בתוך הדפדפן */
import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';

// בדיקות שלב 4: עורך נוסחאות, נוסחאות על הלוח, גרפים, נקודות חיתוך וטבלת ערכים.

type Obj = Record<string, any>;
const objects = (page: Page) =>
  page.evaluate(() => (window as any).__tb.runtime.board.getState().doc.pages[0].objects as Obj[]);

async function typeInFormula(page: Page, text: string) {
  const field = page.getByTestId('formula-field');
  await field.waitFor();
  await page.waitForTimeout(150);
  await field.click();
  await page.keyboard.type(text);
}

async function newGraphWith(page: Page, ...fns: string[]) {
  if ((await page.getByRole('complementary', { name: 'מתמטיקה' }).count()) === 0) {
    await page.getByRole('button', { name: 'מתמטיקה' }).click();
  }
  await page.getByRole('button', { name: 'מערכת צירים חדשה' }).click();
  for (let i = 0; i < fns.length; i++) {
    await page.getByRole('button', { name: 'הוספת פונקציה' }).click();
    const f = page.getByTestId(`function-${i}`);
    await f.waitFor();
    await page.waitForTimeout(200);
    await f.click();
    await page.waitForTimeout(100);
    await page.keyboard.type(fns[i]!);
    await page.keyboard.press('Enter');
  }
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true });
  });
  await page.goto('/?debug=1');
  await expect(page.getByTestId('save-status')).toHaveAttribute('data-status', 'saved');
});

test('formula: write, insert on the board, edit with double click', async ({ page }) => {
  await page.getByRole('button', { name: 'מתמטיקה' }).click();
  await page.getByRole('button', { name: 'נוסחה חדשה' }).click();
  await typeInFormula(page, 'x^2');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.type('+1');
  await page.getByRole('button', { name: 'הוספה ללוח' }).click();
  await expect.poll(async () => (await objects(page)).length).toBe(1);
  const [m] = await objects(page);
  expect(m!.type).toBe('math');
  expect(m!.latex).toBe('x^2+1');
  expect(m!.width).toBeGreaterThan(20);

  // לחיצה כפולה → עריכה
  const sb = await page.evaluate(() => (window as any).__tb.selectionScreenBounds());
  const box = (await page.getByTestId('board').boundingBox())!;
  await page.mouse.dblclick(box.x + sb.x + sb.width / 2, box.y + sb.y + sb.height / 2);
  await expect(page.getByRole('heading', { name: 'עריכת נוסחה' })).toBeVisible();
  await page.waitForTimeout(150);
  await page.keyboard.press('End');
  await page.keyboard.type('=0');
  await page.getByRole('button', { name: 'עדכון' }).click();
  await expect.poll(async () => (await objects(page))[0]!.latex).toBe('x^2+1=0');
  // ביטול מחזיר
  await page.keyboard.press('Control+z');
  await expect.poll(async () => (await objects(page))[0]!.latex).toBe('x^2+1');
});

test('formula templates insert empty structures (fraction, root, system of equations)', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'מתמטיקה' }).click();
  await page.getByRole('button', { name: 'נוסחה חדשה' }).click();
  await typeInFormula(page, 'y=');
  await page.getByRole('button', { name: 'שבר', exact: true }).click();
  await page.waitForTimeout(150);
  await page.keyboard.type('1');
  await page.keyboard.press('Tab');
  await page.keyboard.type('2');
  const value = await page.getByTestId('formula-field').evaluate((el: any) => el.value);
  // MathLive כותב שבר של שתי ספרות בקיצור (\frac12) – שתי הצורות תקינות
  expect(value).toMatch(/^y=\\frac(12|\{1\}\{2\})$/);
});

test('graph: functions, intercepts, value table inserted on the board', async ({ page }) => {
  await newGraphWith(page, 'x^2-3x+2', 'x+2');
  await expect
    .poll(async () => (await objects(page))[0]?.functions?.map((f: Obj) => f.latex))
    .toEqual(['x^2-3x+2', 'x+2']);
  // טבלת ערכים לפונקציה הראשונה: x = -2..2
  const table = page.getByTestId('value-table');
  await expect(table.locator('tr').nth(1)).toHaveText(/y\s*12\s*6\s*2\s*0\s*0/);
  await page.getByRole('button', { name: 'הוספת הטבלה ללוח' }).click();
  const objs = await objects(page);
  expect(objs[1]!.type).toBe('table');
  expect(objs[1]!.rows[1]).toEqual(['y', '12', '6', '2', '0', '0']);
});

test('graph: unclear expression shows a message; range can be changed', async ({ page }) => {
  await newGraphWith(page, 'x+');
  await expect(page.getByText('לא הצלחתי להבין את הביטוי')).toBeVisible();
  const xMax = page.getByLabel('x עד');
  await xMax.fill('20');
  await xMax.press('Enter');
  await expect.poll(async () => (await objects(page))[0]!.range.xMax).toBe(20);
});

test('math objects are saved and exported to PDF', async ({ page }) => {
  await page.getByRole('button', { name: 'מתמטיקה' }).click();
  await page.getByRole('button', { name: 'נוסחה חדשה' }).click();
  await typeInFormula(page, 'a+b');
  await page.getByRole('button', { name: 'הוספה ללוח' }).click();
  await newGraphWith(page, 'sin(x)');
  await expect(page.getByTestId('save-status')).toHaveAttribute('data-status', 'saved');
  await page.reload();
  await expect(page.getByTestId('save-status')).toHaveAttribute('data-status', 'saved');
  expect((await objects(page)).map((o) => o.type)).toEqual(['math', 'graph']);

  await page.getByRole('button', { name: 'ניהול שיעורים וקבצים' }).click();
  const [pdf] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'PDF של העמוד' }).click(),
  ]);
  const doc = await PDFDocument.load(await readFile((await pdf.path())!));
  expect(doc.getPageCount()).toBe(1);
});

test('function names f(x), g(x); enlarging the graph frame widens the range (numbers not stretched)', async ({
  page,
}) => {
  await newGraphWith(page, 'x', '2x');
  await expect(page.getByText('f(x) =', { exact: true })).toBeVisible();
  await expect(page.getByText('g(x) =', { exact: true })).toBeVisible();
  const before = (await objects(page))[0]!;
  // גרירת הפינה הימנית-התחתונה של המסגרת
  const sb = await page.evaluate(() => (window as any).__tb.selectionScreenBounds());
  const box = (await page.getByTestId('board').boundingBox())!;
  const cx = box.x + sb.x + sb.width + 6;
  const cy = box.y + sb.y + sb.height + 6;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 120, cy + 90, { steps: 8 });
  await page.mouse.up();
  const after = (await objects(page))[0]!;
  expect(after.width).toBeGreaterThan(before.width);
  expect(after.transform.scale).toBe(1);
  const unit = (o: any) => o.width / (o.range.xMax - o.range.xMin);
  expect(unit(after)).toBeCloseTo(unit(before), 6);
  expect(after.range.xMax - after.range.xMin).toBeGreaterThan(
    before.range.xMax - before.range.xMin,
  );

  // ניווט: התקרבות (החלונית נסגרה אוטומטית כשגררנו על הלוח – פותחים שוב)
  await page.getByRole('button', { name: 'מתמטיקה' }).click();
  await page.getByRole('button', { name: 'התקרבות' }).click();
  const zoomed = (await objects(page))[0]!;
  expect(zoomed.range.xMax - zoomed.range.xMin).toBeLessThan(after.range.xMax - after.range.xMin);
});

test('graph parameters: writing ax^2 adds a slider; moving it changes the graph (one undo step)', async ({
  page,
}) => {
  await newGraphWith(page, 'ax^2');
  const sliders = page.getByTestId('graph-sliders');
  await expect(sliders).toBeVisible();
  // המקלדת שעל המסך נסגרת אחרי Enter (עם הנפשה קצרה)
  await expect(page.locator('.ML__keyboard.is-visible')).toHaveCount(0);
  await page.waitForTimeout(400);
  const value = () =>
    page.evaluate(() => {
      const s = (window as any).__tb.runtime.board.getState();
      const g = s.doc.pages[0].objects.find((o: any) => o.type === 'graph');
      return g.params?.a?.value;
    });
  expect(await value()).toBe(1);
  const before = await page.evaluate(
    () => (window as any).__tb.runtime.board.getState().history.past.length,
  );
  const slider = sliders.locator('[data-param-slider="a"]');
  const box = (await slider.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.85, box.y + box.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect.poll(value).toBeGreaterThan(5);
  const after = await page.evaluate(
    () => (window as any).__tb.runtime.board.getState().history.past.length,
  );
  expect(after - before).toBe(1);
  // הנפשה ועצירה
  await sliders.locator('[data-param-play="a"]').click();
  await page.waitForTimeout(400);
  await sliders.locator('[data-param-play="a"]').click();
  await expect(sliders.locator('[data-param-slider="a"]')).toBeEnabled();
});

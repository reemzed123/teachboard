/* eslint-disable @typescript-eslint/no-explicit-any -- גישה לכלי הבדיקה window.__tb בתוך הדפדפן */
import { expect, test, type Page } from '@playwright/test';

// בדיקות שלב 2ב: קו, חץ, טקסט, שינוי גודל וסיבוב, שכפול, העתקה, סדר שכבות, קבוצות, נעילה, צבעים מועדפים.

type Obj = {
  id: string;
  type: string;
  kind?: string;
  text?: string;
  locked?: boolean;
  groupId?: string;
  transform: { x: number; y: number; rotation: number; scale: number };
  dx?: number;
  dy?: number;
  style?: { dash?: string };
};

async function boardBox(page: Page) {
  return (await page.getByTestId('board').boundingBox())!;
}

async function drag(
  page: Page,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  opts: { shift?: boolean } = {},
) {
  const b = await boardBox(page);
  if (opts.shift) await page.keyboard.down('Shift');
  await page.mouse.move(b.x + x1, b.y + y1);
  await page.mouse.down();
  await page.mouse.move(b.x + x2, b.y + y2, { steps: 8 });
  await page.mouse.up();
  if (opts.shift) await page.keyboard.up('Shift');
}

async function click(page: Page, x: number, y: number) {
  const b = await boardBox(page);
  await page.mouse.click(b.x + x, b.y + y);
}

const objects = (page: Page) =>
  page.evaluate(() => (window as any).__tb.runtime.board.getState().doc.pages[0].objects as Obj[]);
const count = (page: Page) => page.getByTestId('board').getAttribute('data-object-count');
const selection = (page: Page) =>
  page.evaluate(() => (window as any).__tb.runtime.board.getState().selection as string[]);
const selBounds = (page: Page) =>
  page.evaluate(
    () =>
      (window as any).__tb.selectionScreenBounds() as {
        x: number;
        y: number;
        width: number;
        height: number;
      },
  );

test.beforeEach(async ({ page }) => {
  await page.goto('/?debug=1');
  await expect(page.getByTestId('save-status')).toHaveAttribute('data-status', 'saved');
  await page.evaluate(() =>
    (window as any).__tb.runtime.board.getState().setView({ x: 0, y: 0, scale: 1 }),
  );
});

test('straight line, snapping with Shift, and dashed double arrow', async ({ page }) => {
  await page.keyboard.press('l');
  await drag(page, 100, 100, 300, 112, { shift: true }); // כמעט אופקי → מיושר
  await page.getByRole('button', { name: 'ציור וכתיבה' }).click();
  await page.getByRole('radio', { name: 'חץ' }).click();
  await page.getByRole('radio', { name: 'מקווקו' }).click();
  await page.getByLabel('חץ בשני הקצוות').check();
  await drag(page, 100, 200, 300, 260);
  const [line, arrow] = await objects(page);
  expect(line).toMatchObject({ type: 'shape', kind: 'line' });
  expect(Math.abs(line!.dy!)).toBeLessThan(0.5);
  expect(arrow).toMatchObject({ type: 'shape', kind: 'arrow', arrowStart: true });
  expect(arrow!.style!.dash).toBe('dashed');
  // לחיצה בלי גרירה לא יוצרת קו
  await page.keyboard.press('l');
  await click(page, 500, 500);
  await expect.poll(() => count(page)).toBe('2');
});

test('text: write Hebrew, edit with double click, empty text deletes it', async ({ page }) => {
  await page.keyboard.press('t');
  await click(page, 400, 150);
  const editor = page.getByLabel('כתיבת טקסט');
  await expect(editor).toBeFocused();
  await page.keyboard.type('שלום');
  // קיצורי מקלדת לא פועלים בזמן כתיבה (ה-ל לא מחליף כלי)
  await page.keyboard.type(' עולם');
  await page.keyboard.press('Control+Enter');
  let [txt] = await objects(page);
  expect(txt).toMatchObject({ type: 'text', text: 'שלום עולם', dir: 'rtl' });

  await page.keyboard.press('v');
  const b = await (async () => {
    await click(page, 380, 160);
    return selBounds(page);
  })();
  await page.mouse.dblclick(
    (await boardBox(page)).x + b.x + b.width / 2,
    (await boardBox(page)).y + b.y + b.height / 2,
  );
  await expect(editor).toBeFocused();
  await page.keyboard.press('End');
  await page.keyboard.type('!');
  await page.keyboard.press('Escape');
  [txt] = await objects(page);
  expect(txt!.text).toBe('שלום עולם!');

  await page.keyboard.press('t');
  await click(page, 380, 160);
  await editor.fill('');
  await page.keyboard.press('Escape');
  await expect.poll(() => count(page)).toBe('0');
  await page.keyboard.press('Control+z');
  await expect.poll(() => count(page)).toBe('1');
});

test('resize from a corner and rotate with the handle; undo restores', async ({ page }) => {
  await page.keyboard.press('l');
  await drag(page, 200, 300, 400, 300);
  await page.keyboard.press('v');
  await click(page, 300, 300);
  let b = await selBounds(page);
  // פינה ימנית-תחתונה (עם השוליים של המסגרת)
  await drag(page, b.x + b.width + 6, b.y + b.height + 6, b.x + b.width + 106, b.y + b.height + 6);
  let [line] = await objects(page);
  expect(line!.transform.scale).toBeGreaterThan(1.3);

  b = await selBounds(page);
  const cx = b.x + b.width / 2;
  // ידית הסיבוב: 28 פיקסלים מעל המסגרת; גוררים ימינה ולמטה → סיבוב עם כיוון השעון
  await drag(page, cx, b.y - 6 - 28, cx + 300, b.y + b.height / 2, { shift: true });
  [line] = await objects(page);
  expect(Math.abs(line!.transform.rotation) % 15).toBeCloseTo(0, 5);
  expect(line!.transform.rotation).not.toBe(0);

  await page.keyboard.press('Control+z');
  await page.keyboard.press('Control+z');
  [line] = await objects(page);
  expect(line!.transform).toEqual({ x: 200, y: 300, rotation: 0, scale: 1 });
});

test('duplicate, copy/paste (also to another page) and cut', async ({ page }) => {
  await page.keyboard.press('l');
  await drag(page, 100, 100, 300, 100);
  await page.keyboard.press('v');
  await click(page, 200, 100);
  await page.keyboard.press('Control+d');
  await expect.poll(() => count(page)).toBe('2');
  await page.keyboard.press('Control+c');
  await page.keyboard.press('Control+v');
  await expect.poll(() => count(page)).toBe('3');
  // הדבקה בעמוד אחר – באותו מקום
  await page.locator('[data-action="page.add"]').click();
  await page.keyboard.press('Control+v');
  await expect.poll(() => count(page)).toBe('1');
  await page.keyboard.press('Control+x');
  await expect.poll(() => count(page)).toBe('0');
});

test('layer order, grouping and locking from the selection toolbar', async ({ page }) => {
  await page.keyboard.press('l');
  await drag(page, 100, 100, 300, 100);
  await drag(page, 100, 200, 300, 200);
  const [first, second] = (await objects(page)).map((o) => o.id);
  await page.keyboard.press('v');
  await click(page, 200, 100);
  const bar = page.getByRole('toolbar', { name: 'פעולות על הבחירה' });
  await bar.locator('[data-action="edit.bringFront"]').click();
  expect((await objects(page)).map((o) => o.id)).toEqual([second, first]);

  // קבוצה: בחירת שניהם במלבן → Ctrl+G → לחיצה על אחד בוחרת את שניהם
  await drag(page, 50, 50, 350, 250);
  await page.keyboard.press('Control+g');
  await click(page, 500, 500);
  await click(page, 200, 200);
  expect((await selection(page)).sort()).toEqual([first, second].sort());
  await page.keyboard.press('Control+Shift+g');
  await click(page, 500, 500);
  await click(page, 200, 200);
  expect(await selection(page)).toEqual([second]);

  // נעילה: נבחר רק לתצוגה (עם "ביטול נעילה"), ולא נמחק
  await bar.locator('[data-action="edit.lock"]').click();
  await click(page, 200, 200);
  await expect(bar.locator('[data-action="edit.unlock"]')).toBeVisible();
  await page.keyboard.press('e');
  await drag(page, 200, 190, 200, 210);
  await expect.poll(() => count(page)).toBe('2');
  // ביטול נעילה
  await page.getByRole('button', { name: 'ציור וכתיבה' }).click();
  await page.getByRole('radio', { name: 'בחירה' }).click();
  await page.locator('[data-action="edit.unlockAll"]').click();
  expect((await objects(page)).some((o) => o.locked)).toBe(false);
});

test('favorite colors: add, use after reload, remove', async ({ page }) => {
  await page.getByRole('button', { name: 'ציור וכתיבה' }).click();
  await page.getByLabel('צבע אחר לבחירה').first().fill('#123456');
  await page.getByRole('button', { name: 'הוספת הצבע הנוכחי לצבעים שלי' }).click();
  await page.reload();
  await page.getByRole('button', { name: 'ציור וכתיבה' }).click();
  const fav = page
    .getByRole('group', { name: 'הצבעים שלי' })
    .getByRole('button', { name: 'צבע #123456' });
  await expect(fav).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'הסרת #123456 מהצבעים שלי' }).click({ force: true });
  await expect(fav).toHaveCount(0);
});

test('lines, arrows, text and groups are saved and come back after reload', async ({ page }) => {
  await page.keyboard.press('a');
  await drag(page, 100, 100, 300, 150);
  await page.keyboard.press('t');
  await click(page, 500, 150);
  await page.keyboard.type('טקסט');
  await page.keyboard.press('Control+Enter');
  await page.keyboard.press('v');
  await drag(page, 50, 50, 600, 250);
  await page.keyboard.press('Control+g');
  await expect(page.getByTestId('save-status')).toHaveAttribute('data-status', 'saved');
  await page.reload();
  await expect(page.getByTestId('save-status')).toHaveAttribute('data-status', 'saved');
  const objs = await objects(page);
  expect(objs.map((o) => o.type)).toEqual(['shape', 'text']);
  expect(objs[0]!.groupId).toBeTruthy();
  expect(objs[0]!.groupId).toBe(objs[1]!.groupId);
});

test('text is kept when finishing by clicking on the board or switching tool', async ({ page }) => {
  await page.keyboard.press('t');
  await click(page, 400, 150);
  await page.keyboard.type('ראשון');
  // סיום בלחיצה על הלוח (כך שהתיבה נסגרת "מבחוץ")
  await click(page, 600, 400);
  await expect.poll(async () => (await objects(page)).map((o) => o.text)).toEqual(['ראשון']);

  await click(page, 400, 300);
  await page.keyboard.type('שני');
  // סיום במעבר כלי מהסרגל העליון
  await page.locator('.tb-quick [data-action="tool.pen"]').click();
  await expect.poll(async () => (await objects(page)).map((o) => o.text)).toEqual(['ראשון', 'שני']);
});

test('a locked object can be clicked to show "unlock", and is protected from Delete', async ({
  page,
}) => {
  await page.keyboard.press('l');
  await drag(page, 100, 200, 300, 200);
  await page.keyboard.press('v');
  await click(page, 200, 200);
  const bar = page.getByRole('toolbar', { name: 'פעולות על הבחירה' });
  await bar.locator('[data-action="edit.lock"]').click();
  await expect(bar).toHaveCount(0);

  // לחיצה על האובייקט הנעול – נבחר לתצוגה, עם לחצן ביטול נעילה בלבד
  await click(page, 200, 200);
  await expect(bar.locator('[data-action="edit.unlock"]')).toBeVisible();
  await expect(bar.locator('[data-action="edit.deleteSelection"]')).toHaveCount(0);
  // גרירה לא מזיזה, Delete לא מוחק
  await drag(page, 200, 200, 260, 260);
  expect((await objects(page))[0]!.transform.x).toBe(100);
  await page.keyboard.press('Delete');
  await expect.poll(() => count(page)).toBe('1');

  await bar.locator('[data-action="edit.unlock"]').click();
  expect((await objects(page))[0]!.locked).toBeUndefined();
  await click(page, 200, 200);
  await expect(bar.locator('[data-action="edit.lock"]')).toBeVisible();
});

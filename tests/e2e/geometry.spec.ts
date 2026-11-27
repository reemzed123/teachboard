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
  // בבדיקות הבנייה החלונית נשארת פתוחה (בוחרים בה כלים שוב ושוב)
  await page.evaluate(() => (window as any).__tb.runtime.app.getState().setAutoClosePanel(false));
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

const CM = 96 / 2.54;
const d = (p: any, q: any) => Math.hypot(q.x - p.x, q.y - p.y);

test('regular polygon up to 20 sides; options shown at the top of the panel', async ({ page }) => {
  await tool(page, 'regularPolygon');
  const sides = page.getByTestId('geo-sides');
  await expect(sides.locator('option')).toHaveCount(18);
  // האפשרויות מופיעות לפני רשימת הכלים
  const sidesBox = (await sides.boundingBox())!;
  const firstTool = (await page.locator('[data-geo-tool="move"]').boundingBox())!;
  expect(sidesBox.y).toBeLessThan(firstTool.y);
  await sides.selectOption('8');
  await click(page, 300, 450);
  await click(page, 380, 450);
  const sol = await solution(page);
  const poly = Object.values(sol).find((e: any) => e.kind === 'polygon') as any;
  expect(poly.pts.length / 2).toBe(8);
});

test('known shape: rectangle by size keeps its size (fixed) and its rules (free)', async ({
  page,
}) => {
  await tool(page, 'shape');
  const opts = page.getByTestId('geo-shape-options');
  await page.getByTestId('geo-shape-select').selectOption('rectangle');
  await opts.locator('[data-dim="a"]').fill('5');
  await opts.locator('[data-dim="b"]').fill('2');
  await click(page, 200, 450);
  let sol = await solution(page);
  expect(d(sol.A, sol.B) / CM).toBeCloseTo(5, 1);
  expect(d(sol.B, sol.C) / CM).toBeCloseTo(2, 1);

  // גודל קבוע: גרירת B רק מסובבת
  await tool(page, 'move');
  await drag(page, sol.B.x, sol.B.y, sol.B.x, sol.B.y - 100);
  sol = await solution(page);
  expect(d(sol.A, sol.B) / CM).toBeCloseTo(5, 1);
  expect(d(sol.A, sol.C)).toBeCloseTo(d(sol.B, sol.D), 3); // עדיין מלבן

  // אי אפשר לבנות משולש בלתי אפשרי – ומוצג הסבר
  await tool(page, 'shape');
  await page.getByTestId('geo-shape-select').selectOption('triSSS');
  await opts.locator('[data-dim="a"]').fill('1');
  await opts.locator('[data-dim="b"]').fill('1');
  await opts.locator('[data-dim="c"]').fill('5');
  await expect(page.getByTestId('geo-shape-error')).toBeVisible();

  // גודל משתנה: מעוין נשאר מעוין גם כשמגדילים
  await page.getByTestId('geo-shape-select').selectOption('rhombus');
  await opts.locator('[data-dim="a"]').fill('3');
  await opts.locator('[data-dim="angle"]').fill('60');
  await opts.getByRole('radio', { name: /גודל משתנה/ }).check();
  await click(page, 600, 300);
  sol = await solution(page);
  const [E, F, G, H] = [sol.E, sol.F, sol.G, sol.H];
  expect(d(E, F) / CM).toBeCloseTo(3, 1);
  await tool(page, 'move');
  await drag(page, F.x, F.y, F.x + 60, F.y);
  sol = await solution(page);
  const side = d(sol.E, sol.F);
  expect(side / CM).toBeGreaterThan(4);
  expect(d(sol.F, sol.G)).toBeCloseTo(side, 3);
  expect(d(sol.G, sol.H)).toBeCloseTo(side, 3);
  expect(G && H).toBeTruthy();
});

test('polygon decorations: medians and angles on a triangle, turned on and off', async ({
  page,
}) => {
  await triangle(page);
  await tool(page, 'move');
  await click(page, 280, 380); // בתוך המשולש
  const deco = page.getByTestId('geo-decorations');
  await expect(deco).toBeVisible();
  await deco.locator('[data-deco="medians"]').check();
  let sol = await solution(page);
  const mids = Object.values(sol).filter((e: any) => e.kind === 'midpoint');
  expect(mids).toHaveLength(3);
  await deco.locator('[data-deco="angles"]').check();
  sol = await solution(page);
  const angles = Object.values(sol).filter((e: any) => e.kind === 'angle') as any[];
  expect(angles.reduce((s, a) => s + a.deg, 0)).toBeCloseTo(180, 3);
  await deco.locator('[data-deco="medians"]').uncheck();
  sol = await solution(page);
  expect(Object.values(sol).filter((e: any) => e.kind === 'midpoint')).toHaveLength(0);
});

test('circle popup bar: central and inscribed angles, tangent; algebraic label for an angle', async ({
  page,
}) => {
  await tool(page, 'circle');
  await click(page, 400, 350);
  await click(page, 550, 350);
  // הכלים של המעגל לא בחלונית – הם בסרגל שקופץ כשבוחרים מעגל
  await expect(page.locator('[data-geo-tool="centralAngle"]')).toHaveCount(0);
  await tool(page, 'move');
  await click(page, 400, 200); // המעגל (למעלה)
  const bar = page.getByTestId('geo-circle-bar');
  await expect(bar).toBeVisible();
  await bar.locator('[data-circle-tool="centralAngle"]').click();
  await expect(page.getByTestId('geo-hint')).toContainText('שתי נקודות על המעגל');
  await click(page, 250, 350); // נקודה על המעגל
  await click(page, 400, 500); // נקודה על המעגל
  let sol = await solution(page);
  const central = Object.values(sol).find((e: any) => e.kind === 'angle') as any;
  expect(central.deg).toBeCloseTo(90, 0);
  // בסיום חוזרים לבחירה והמעגל נשאר מסומן – הסרגל שוב זמין
  await expect(bar).toBeVisible();

  await bar.locator('[data-circle-tool="inscribedAngle"]').click();
  await click(page, 506, 244); // קודקוד על המעגל
  await click(page, 250, 350); // נקודה קיימת C
  await click(page, 400, 500); // נקודה קיימת D
  sol = await solution(page);
  const angles = Object.values(sol).filter((e: any) => e.kind === 'angle') as any[];
  expect(angles).toHaveLength(2);
  // זווית היקפית = חצי מהמרכזית הנשענת על אותה קשת
  expect(angles[1].deg).toBeCloseTo(45, 0);

  // משיק מנקודה חיצונית: שני ישרים
  await bar.locator('[data-circle-tool="tangent"]').click();
  await click(page, 700, 350);
  sol = await solution(page);
  expect(Object.values(sol).filter((e: any) => e.kind === 'line')).toHaveLength(2);

  // ביטוי אלגברי לזווית
  const s = await page.evaluate(() => {
    const st = (window as any).__tb.runtime.board.getState();
    const g = st.doc.pages
      .find((p: any) => p.id === st.pageId)
      .objects.find((o: any) => o.type === 'geometry');
    const angle = g.elements.find((e: any) => e.kind === 'angle');
    st.setGeoSelection({ objectId: g.id, ids: [angle.id] });
    return angle.id;
  });
  expect(s).toBeTruthy();
  await page.getByTestId('geo-text').fill('x+3');
  await page.getByTestId('geo-text').press('Enter');
  const text = await page.evaluate(() => {
    const st = (window as any).__tb.runtime.board.getState();
    const g = st.doc.pages
      .find((p: any) => p.id === st.pageId)
      .objects.find((o: any) => o.type === 'geometry');
    return g.elements.find((e: any) => e.kind === 'angle').style.text;
  });
  expect(text).toBe('x+3');
});

const geoEls = (page: Page) =>
  page.evaluate(() => {
    const st = (window as any).__tb.runtime.board.getState();
    const g = st.doc.pages
      .find((p: any) => p.id === st.pageId)
      .objects.find((o: any) => o.type === 'geometry');
    return g.elements;
  });

async function dbl(page: Page, x: number, y: number) {
  const box = (await page.getByTestId('board').boundingBox())!;
  await page.mouse.click(box.x + x, box.y + y);
  await page.mouse.click(box.x + x, box.y + y);
  await page.waitForTimeout(80);
}

test('labels on the board: edit by double-click, expression replaces the value, drag labels and arcs, hide dots/letters', async ({
  page,
}) => {
  await triangle(page); // A(150,450) B(450,450) C(250,200)
  await tool(page, 'move');
  await click(page, 280, 380); // בתוך המשולש
  const deco = page.getByTestId('geo-decorations');
  await deco.locator('[data-deco="sides"]').check();
  await deco.locator('[data-deco="angles"]').check();

  // לחיצה כפולה על הצלע AB – עריכה במקום
  await dbl(page, 300, 450);
  const editor = page.getByTestId('geo-label-editor');
  await expect(editor).toBeVisible();
  await editor.fill('2x');
  await editor.press('Enter');
  await expect(editor).toHaveCount(0);
  let els = await geoEls(page);
  const ab = els.find((e: any) => e.kind === 'segment' && e.style.text === '2x');
  expect(ab).toBeTruthy();

  // לחיצה כפולה על הקשת של הזווית ב-A
  await dbl(page, 171.5, 435.5);
  await expect(editor).toBeVisible();
  await editor.fill('x+3');
  await editor.press('Enter');
  els = await geoEls(page);
  expect(els.filter((e: any) => e.kind === 'angle' && e.style.text === 'x+3')).toHaveLength(1);

  // גרירת הביטוי של הצלע למעלה
  await drag(page, 300, 434, 300, 404);
  els = await geoEls(page);
  const moved = els.find((e: any) => e.id === ab.id);
  expect(moved.style.labelOffset.dy).toBeLessThan(-20);

  // גרירת הקשת של הזווית ב-A החוצה – הקשת גדלה
  await drag(page, 171.5, 435.5, 194, 421);
  els = await geoEls(page);
  const angleA = els.find((e: any) => e.kind === 'angle' && e.style.text === 'x+3');
  expect(angleA.style.arcRadius).toBeGreaterThan(40);

  // הסתרת נקודות הקודקודים בלי האותיות
  await click(page, 280, 380);
  await deco.locator('[data-deco="dots"]').uncheck();
  els = await geoEls(page);
  const verts = els.filter((e: any) => e.kind === 'point');
  expect(verts.every((v: any) => v.style.hideDot && v.style.showLabel !== false)).toBe(true);
  await deco.locator('[data-deco="letters"]').uncheck();
  els = await geoEls(page);
  expect(
    els.filter((e: any) => e.kind === 'point').every((v: any) => v.style.showLabel === false),
  ).toBe(true);
});

test('the geometry panel closes when building on the board, but stays open when selecting an element', async ({
  page,
}) => {
  await page.evaluate(() => (window as any).__tb.runtime.app.getState().setAutoClosePanel(true));
  const panel = () => page.evaluate(() => (window as any).__tb.runtime.app.getState().openPanel);
  await tool(page, 'segment');
  await click(page, 150, 300);
  expect(await panel()).toBeNull();
  await page.getByRole('button', { name: 'גיאומטריה' }).click();
  await tool(page, 'move');
  await click(page, 150, 300); // הנקודה – נבחרת, והחלונית מציגה את המאפיינים
  await expect.poll(panel).toBe('geometry');
  await expect(page.getByTestId('geo-inspector')).toBeVisible();
  await click(page, 500, 150); // מקום ריק – נסגרת
  await expect.poll(panel).toBeNull();
});

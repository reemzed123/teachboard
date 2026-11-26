/* eslint-disable @typescript-eslint/no-explicit-any -- גישה לכלי הבדיקה window.__tb בתוך הדפדפן */
import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';

// בדיקות שלב 3: שמירה אוטומטית, שחזור אחרי סגירה פתאומית, עמודים, רקעים, קבצים וייצוא.

async function ready(page: Page) {
  await expect(page.getByTestId('save-status')).toHaveAttribute('data-status', 'saved');
}

async function draw(page: Page, y = 200) {
  const box = (await page.getByTestId('board').boundingBox())!;
  await page.mouse.move(box.x + 100, box.y + y);
  await page.mouse.down();
  await page.mouse.move(box.x + 300, box.y + y + 20, { steps: 6 });
  await page.mouse.up();
}

const count = (page: Page) => page.getByTestId('board').getAttribute('data-object-count');

test.beforeEach(async ({ page }) => {
  // בבדיקות: שמירה כהורדה רגילה (בלי חלון "שמירה בשם" של מערכת ההפעלה)
  await page.addInitScript(() => {
    Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true });
  });
  await page.goto('/?debug=1');
  await ready(page);
});

test('drawings are saved automatically and come back after reload', async ({ page }) => {
  await draw(page);
  await draw(page, 300);
  await expect.poll(() => count(page)).toBe('2');
  await ready(page);
  await page.reload();
  await ready(page);
  await expect.poll(() => count(page)).toBe('2');
});

test('sudden close loses at most a few seconds of work', async ({ page, context }) => {
  await draw(page);
  await page.waitForTimeout(1500); // שמירה אוטומטית אחרי פחות משנייה
  await page.close({ runBeforeUnload: false }); // "קריסה": בלי אירועי סגירה מסודרים
  const again = await context.newPage();
  await again.goto('/?debug=1');
  await ready(again);
  await expect.poll(() => count(again)).toBe('1');
});

test('pages: add, draw, switch, delete with confirmation, undo', async ({ page }) => {
  await draw(page);
  await page.locator('[data-action="page.add"]').click();
  await expect(page.getByRole('tab', { name: 'עמוד 2' })).toHaveAttribute('aria-selected', 'true');
  await expect.poll(() => count(page)).toBe('0');
  await draw(page);
  await draw(page, 300);
  await page.getByRole('tab', { name: 'עמוד 1' }).click();
  await expect.poll(() => count(page)).toBe('1');
  await page.keyboard.press('PageDown');
  await expect.poll(() => count(page)).toBe('2');

  await page.locator('[data-action="page.delete"]').click();
  await page.getByRole('dialog').getByRole('button', { name: 'מחיקת העמוד' }).click();
  await expect(page.getByRole('tab')).toHaveCount(1);
  await page.keyboard.press('Control+z');
  await expect(page.getByRole('tab')).toHaveCount(2);

  // העמודים נשמרים
  await ready(page);
  await page.reload();
  await ready(page);
  await expect(page.getByRole('tab')).toHaveCount(2);
});

test('background pattern and page color are saved per page', async ({ page }) => {
  await page.getByRole('button', { name: 'תבניות ורקעים' }).click();
  await page.getByRole('radio', { name: 'משבצות' }).click();
  await page.getByRole('button', { name: 'לוח ירוק' }).click();
  await ready(page);
  await page.reload();
  await ready(page);
  const bg = await page.evaluate(() => {
    const s = (window as any).__tb.runtime.board.getState();
    return s.doc.pages[0].background;
  });
  expect(bg.pattern).toBe('grid');
  expect(bg.color).toBe('#24413a');
});

test('switching to infinite board and back keeps all content', async ({ page }) => {
  await draw(page);
  await page.getByRole('button', { name: 'תבניות ורקעים' }).click();
  await page.getByLabel('לוח אינסופי').check();
  await expect(page.getByTestId('board')).toHaveAttribute('data-layout', 'infinite');
  await page.getByLabel('עמוד מחברת').check();
  await expect.poll(() => count(page)).toBe('1');
});

test('lesson library: new lesson, rename, switch back', async ({ page }) => {
  await draw(page);
  const title = page.getByLabel('שם השיעור');
  await title.fill('שברים');
  await title.press('Enter');
  await page.getByRole('button', { name: 'ניהול שיעורים וקבצים' }).click();
  await page.getByRole('button', { name: 'שיעור חדש' }).click();
  await expect(title).toHaveValue('שיעור ללא שם');
  await expect.poll(() => count(page)).toBe('0');
  await page.getByRole('button', { name: 'פתיחה: שברים' }).click();
  await expect(title).toHaveValue('שברים');
  await expect.poll(() => count(page)).toBe('1');
  await page.getByPlaceholder('חיפוש שיעור').fill('שבר');
  await expect(page.locator('.tb-lesson-item')).toHaveCount(1);
});

test('save as .board, then open it as a new lesson', async ({ page }) => {
  await draw(page);
  await draw(page, 320);
  // (דפדפן הבדיקות לא שומר שמות קבצים בעברית בהורדה; Chrome/Edge רגילים כן)
  await page.getByLabel('שם השיעור').fill('Fractions');
  await page.getByLabel('שם השיעור').press('Enter');
  await page.getByRole('button', { name: 'ניהול שיעורים וקבצים' }).click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'שמירה כקובץ שיעור' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('Fractions.board');
  const path = await download.path();
  const bytes = await readFile(path!);
  expect(bytes[0]).toBe(0x50); // ZIP

  await page.getByRole('button', { name: 'שיעור חדש' }).click();
  await expect.poll(() => count(page)).toBe('0');
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('button', { name: 'פתיחת קובץ שיעור' }).click(),
  ]);
  await chooser.setFiles(path!);
  await expect(page.getByTestId('notice')).toContainText('נפתח');
  await expect.poll(() => count(page)).toBe('2');
});

test('opening a damaged file shows a clear message and changes nothing', async ({ page }) => {
  await draw(page);
  await page.getByRole('button', { name: 'ניהול שיעורים וקבצים' }).click();
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('button', { name: 'פתיחת קובץ שיעור' }).click(),
  ]);
  await chooser.setFiles({
    name: 'bad.board',
    mimeType: 'application/octet-stream',
    buffer: Buffer.from('not a zip'),
  });
  await expect(page.getByTestId('notice')).toContainText('לא קובץ שיעור תקין');
  await expect.poll(() => count(page)).toBe('1');
});

test('export PNG and PDF', async ({ page }) => {
  await draw(page);
  await page.getByRole('button', { name: 'ניהול שיעורים וקבצים' }).click();
  const [png] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'תמונה (PNG) של העמוד' }).click(),
  ]);
  const pngBytes = await readFile((await png.path())!);
  expect([...pngBytes.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);

  await page.locator('[data-action="page.add"]').click();
  const [pdf] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'PDF של כל השיעור' }).click(),
  ]);
  const pdfBytes = await readFile((await pdf.path())!);
  expect(pdfBytes.subarray(0, 4).toString('latin1')).toBe('%PDF');
  const parsed = await PDFDocument.load(pdfBytes);
  expect(parsed.getPageCount()).toBe(2);
  // עמוד מחברת = A4 לרוחב (842×595 נקודות)
  const { width, height } = parsed.getPage(0).getSize();
  expect(Math.round(width)).toBe(842);
  expect(Math.round(height)).toBe(596);
});

test('previous versions can be restored', async ({ page }) => {
  await page.getByRole('button', { name: 'ניהול שיעורים וקבצים' }).click();
  await draw(page); // החלונית נסגרת אוטומטית
  await ready(page);
  await page.getByRole('button', { name: 'ניהול שיעורים וקבצים' }).click();
  await page
    .locator('section[aria-label="גרסאות קודמות"]')
    .getByRole('button', { name: 'גרסאות קודמות' })
    .click();
  // הגרסה הראשונה: שיעור ריק
  await page.getByRole('button', { name: 'שחזור' }).last().click();
  await page.getByRole('dialog').getByRole('button', { name: 'שחזור' }).click();
  await expect.poll(() => count(page)).toBe('0');
});

test('side panel closes automatically when starting to write (and the setting can turn it off)', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'ציור וכתיבה' }).click();
  await draw(page);
  await expect(page.getByRole('complementary')).toHaveCount(0);

  await page.getByRole('button', { name: 'הגדרות' }).click();
  await page.getByLabel('סגירה אוטומטית של החלונית הצדדית כשמתחילים לכתוב על הלוח').uncheck();
  await draw(page, 350);
  await expect(page.getByRole('complementary', { name: 'הגדרות' })).toBeVisible();
});

test('notebook page can be portrait; PDF page is portrait A4', async ({ page }) => {
  await page.getByRole('button', { name: 'תבניות ורקעים' }).click();
  await page.getByRole('radio', { name: 'לאורך' }).click();
  const size = await page.evaluate(
    () => (window as any).__tb.runtime.board.getState().doc.pages[0].size,
  );
  expect(size).toEqual({ width: 794, height: 1123 });
  // עמוד חדש מקבל את אותו כיוון
  await page.locator('[data-action="page.add"]').click();
  const size2 = await page.evaluate(
    () => (window as any).__tb.runtime.board.getState().doc.pages[1].size,
  );
  expect(size2).toEqual({ width: 794, height: 1123 });

  await page.getByRole('button', { name: 'ניהול שיעורים וקבצים' }).click();
  const [pdf] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'PDF של העמוד' }).click(),
  ]);
  const doc = await PDFDocument.load(await readFile((await pdf.path())!));
  const { width, height } = doc.getPage(0).getSize();
  expect(Math.round(width)).toBe(596);
  expect(Math.round(height)).toBe(842);
});

test('folders: create, rename, drag a lesson in, subfolder, move with menu, delete keeps lessons', async ({ page }) => {
  await draw(page);
  await page.getByLabel('שם השיעור').fill('שברים');
  await page.getByLabel('שם השיעור').press('Enter');
  await page.getByRole('button', { name: 'ניהול שיעורים וקבצים' }).click();

  // תיקייה חדשה – נפתחת לשינוי שם
  await page.getByRole('button', { name: 'תיקייה חדשה' }).click();
  await page.getByRole('textbox', { name: 'שינוי שם' }).fill('כיתה ז');
  await page.getByRole('textbox', { name: 'שינוי שם' }).press('Enter');
  const folder = page.locator('.tb-folder-item', { hasText: 'כיתה ז' });
  await expect(folder).toBeVisible();

  // גרירת השיעור לתיקייה
  await page.locator('.tb-lesson-item', { hasText: 'שברים' }).dragTo(folder);
  await expect(page.locator('.tb-lesson-item:not(.tb-folder-item)', { hasText: 'שברים' })).toHaveCount(0);
  await page.getByRole('button', { name: 'פתיחת תיקייה: כיתה ז' }).click();
  await expect(page.getByRole('button', { name: 'פתיחה: שברים' })).toBeVisible();

  // תת-תיקייה, והעברת השיעור אליה דרך "העברה אל…"
  await page.getByRole('button', { name: 'תיקייה חדשה' }).click();
  await page.getByRole('textbox', { name: 'שינוי שם' }).fill('חוברת');
  await page.getByRole('textbox', { name: 'שינוי שם' }).press('Enter');
  await page.locator('.tb-lesson-item', { hasText: 'שברים' }).getByRole('button', { name: 'העברה אל…' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'חוברת' }).click();
  await page.getByRole('button', { name: 'פתיחת תיקייה: חוברת' }).click();
  await expect(page.getByRole('navigation', { name: 'מיקום' })).toContainText('כיתה ז');
  await expect(page.getByRole('button', { name: 'פתיחה: שברים' })).toBeVisible();

  // החיפוש מוצא שיעורים בכל התיקיות
  await page.getByRole('navigation', { name: 'מיקום' }).getByRole('button', { name: 'כל השיעורים' }).click();
  await page.getByPlaceholder('חיפוש שיעור').fill('שבר');
  await expect(page.getByRole('button', { name: 'פתיחה: שברים' })).toBeVisible();
  await page.getByPlaceholder('חיפוש שיעור').fill('');

  // מחיקת "כיתה ז": השיעור לא נמחק
  await page.locator('.tb-folder-item', { hasText: 'כיתה ז' }).getByRole('button', { name: 'מחיקת תיקייה' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'מחיקת התיקייה' }).click();
  await expect(page.getByRole('button', { name: 'פתיחת תיקייה: חוברת' })).toBeVisible();
  const lessonsCount = await page.evaluate(() => (window as any).__tb.runtime.lessons.getState().lessons.length);
  expect(lessonsCount).toBe(1);

  // התיקיות נשמרות
  await page.reload();
  await expect(page.getByTestId('save-status')).toHaveAttribute('data-status', 'saved');
  await page.getByRole('button', { name: 'ניהול שיעורים וקבצים' }).click();
  await expect(page.getByRole('button', { name: 'פתיחת תיקייה: חוברת' })).toBeVisible();
});

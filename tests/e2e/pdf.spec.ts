/* eslint-disable @typescript-eslint/no-explicit-any -- גישה לכלי הבדיקה window.__tb בתוך הדפדפן */
import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { degrees, PDFDict, PDFDocument, PDFName, PDFRawStream, rgb, StandardFonts } from 'pdf-lib';

// בדיקות שלב 6: פתיחת PDF, כתיבה מעליו, ייצוא חד, והמקור לא משתנה.

/** PDF לבדיקה: עמוד A4 לאורך עם טקסט וריבוע אדום, ועמוד שני מסובב */
async function samplePdf(): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const p1 = doc.addPage([595, 842]);
  p1.drawRectangle({ x: 50, y: 700, width: 200, height: 100, color: rgb(1, 0, 0) });
  p1.drawText('Worksheet 1', { x: 60, y: 650, size: 28, font });
  const p2 = doc.addPage([400, 300]);
  p2.drawText('Second', { x: 20, y: 150, size: 24, font });
  p2.setRotation(degrees(90));
  return Buffer.from(await doc.save());
}

const count = (page: Page) => page.getByTestId('board').getAttribute('data-object-count');

async function draw(page: Page, y = 300) {
  const box = (await page.getByTestId('board').boundingBox())!;
  await page.mouse.move(box.x + 120, box.y + y);
  await page.mouse.down();
  await page.mouse.move(box.x + 320, box.y + y + 30, { steps: 8 });
  await page.mouse.up();
}

async function openPdf(page: Page, buttonName: string, buffer: Buffer) {
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('button', { name: buttonName }).click(),
  ]);
  await chooser.setFiles({ name: 'worksheet.pdf', mimeType: 'application/pdf', buffer });
}

/** פותח את חלונית הקבצים (היא נסגרת אוטומטית כשכותבים על הלוח) */
async function filesPanel(page: Page) {
  if (!(await page.getByRole('button', { name: 'שיעור חדש', exact: true }).isVisible()))
    await page.getByRole('button', { name: 'ניהול שיעורים וקבצים' }).click();
}

const pagesInfo = (page: Page) =>
  page.evaluate(() => {
    const s = (window as any).__tb.runtime.board.getState();
    return s.doc.pages.map((p: any) => ({ size: p.size, pdf: p.background.pdf ?? null }));
  });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true });
  });
  await page.goto('/?debug=1');
  await expect(page.getByTestId('save-status')).toHaveAttribute('data-status', 'saved');
});

test('open a PDF as a new lesson, write on it, export a sharp PDF; source unchanged', async ({
  page,
}) => {
  const external: string[] = [];
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (!['localhost', '127.0.0.1'].includes(u.hostname) && u.protocol.startsWith('http'))
      external.push(r.url());
  });
  const source = await samplePdf();
  const original = Buffer.from(source);
  await filesPanel(page);
  await openPdf(page, 'פתיחת PDF כשיעור חדש', source);
  await expect(page.getByTestId('notice')).toContainText('2 עמודים');

  const pages = await pagesInfo(page);
  expect(pages).toHaveLength(2);
  // A4 לאורך ב-96 נקודות לאינץ'; העמוד המסובב – רוחב וגובה מתחלפים
  expect(pages[0].size).toEqual({ width: 793, height: 1123 });
  expect(pages[1].size).toEqual({ width: 400, height: 533 });
  expect(pages[1].pdf.page).toBe(1);
  await expect(page.getByLabel('שם השיעור')).toHaveValue('worksheet');

  // העמוד מצויר על הלוח (ריבוע אדום בפינה העליונה)
  await page.evaluate(() =>
    (window as any).__tb.runtime.board.getState().setView({ x: 0, y: 0, scale: 1 }),
  );
  await expect
    .poll(() =>
      page.evaluate(() => {
        const c = document.querySelector('[data-testid="board"] canvas') as HTMLCanvasElement;
        const d = c
          .getContext('2d')!
          .getImageData(
            Math.round(100 * devicePixelRatio),
            Math.round(100 * devicePixelRatio),
            1,
            1,
          ).data;
        return d[0]! > 200 && d[1]! < 80 && d[2]! < 80;
      }),
    )
    .toBe(true);

  await page.keyboard.press('Escape');
  await draw(page);
  await expect.poll(() => count(page)).toBe('1');

  await filesPanel(page);
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'PDF של כל השיעור' }).click(),
  ]);
  const out = await PDFDocument.load(await readFile((await download.path())!));
  expect(out.getPageCount()).toBe(2);
  const { width, height } = out.getPage(0).getSize();
  expect(Math.round(width)).toBe(595);
  expect(Math.round(height)).toBe(842);
  // העמוד המקורי מוטמע כתוכן וקטורי (XObject מסוג Form), לא כתמונה
  const xo = out.getPage(0).node.Resources()!.lookup(PDFName.of('XObject'), PDFDict);
  const subtypes = xo
    .keys()
    .map((k) => (out.context.lookup(xo.get(k)) as PDFRawStream).dict.get(PDFName.of('Subtype')))
    .map(String);
  expect(subtypes).toContain('/Form');

  // המקור לא השתנה
  expect(source.equals(original)).toBe(true);
  expect(external).toEqual([]);
});

test('add PDF pages after the current page; undo removes them; .board keeps the PDF', async ({
  page,
}) => {
  await draw(page);
  await filesPanel(page);
  await openPdf(page, 'הוספת PDF לשיעור הנוכחי', await samplePdf());
  await expect.poll(async () => (await pagesInfo(page)).length).toBe(3);
  const pages = await pagesInfo(page);
  expect(pages[0].pdf).toBeNull();
  expect(pages[1].pdf.page).toBe(0);
  // ביטול ואז חזרה
  await page.evaluate(() => (window as any).__tb.runtime.board.getState().undo());
  await expect.poll(async () => (await pagesInfo(page)).length).toBe(1);
  await page.evaluate(() => (window as any).__tb.runtime.board.getState().redo());
  await expect.poll(async () => (await pagesInfo(page)).length).toBe(3);

  // שמירה כקובץ שיעור ופתיחה מחדש – עמודי ה-PDF נשמרים
  const [saved] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'שמירה כקובץ שיעור' }).click(),
  ]);
  const path = (await saved.path())!;
  await page.getByRole('button', { name: 'שיעור חדש', exact: true }).click();
  await expect.poll(async () => (await pagesInfo(page)).length).toBe(1);
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('button', { name: 'פתיחת קובץ שיעור' }).click(),
  ]);
  await chooser.setFiles(path);
  await expect.poll(async () => (await pagesInfo(page)).length).toBe(3);
  expect((await pagesInfo(page))[2].pdf.page).toBe(1);
});

test('a file that is not a PDF shows a clear message and changes nothing', async ({ page }) => {
  await filesPanel(page);
  await openPdf(page, 'הוספת PDF לשיעור הנוכחי', Buffer.from('not a pdf at all'));
  await expect(page.getByTestId('notice')).toContainText('לא קובץ PDF תקין');
  expect(await pagesInfo(page)).toHaveLength(1);
});

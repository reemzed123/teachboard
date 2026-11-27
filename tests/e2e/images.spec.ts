/* eslint-disable @typescript-eslint/no-explicit-any -- גישה לכלי הבדיקה window.__tb בתוך הדפדפן */
import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { PDFDict, PDFDocument, PDFName, PDFRawStream } from 'pdf-lib';

// תמונות על הלוח: כפתור, הדבקה (Ctrl+V), גרירת קובץ; ייצוא PDF עם התמונה המקורית.

async function pngBytes(page: Page, w = 300, h = 150, color = 'red'): Promise<Buffer> {
  const url = await page.evaluate(
    ({ w, h, color }) => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const x = c.getContext('2d')!;
      x.fillStyle = color;
      x.fillRect(0, 0, w, h);
      return c.toDataURL('image/png');
    },
    { w, h, color },
  );
  return Buffer.from(url.split(',')[1]!, 'base64');
}

const images = (page: Page) =>
  page.evaluate(() => {
    const s = (window as any).__tb.runtime.board.getState();
    return s.doc.pages
      .find((p: any) => p.id === s.pageId)
      .objects.filter((o: any) => o.type === 'image')
      .map((o: any) => ({ w: o.width, h: o.height, x: o.transform.x, y: o.transform.y }));
  });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true });
  });
  await page.goto('/?debug=1');
  await expect(page.getByTestId('save-status')).toHaveAttribute('data-status', 'saved');
});

test('add an image with the button; it is selected and keeps its proportions', async ({ page }) => {
  const png = await pngBytes(page, 800, 400);
  await page.getByRole('button', { name: 'PDF ומסמכים' }).click();
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.locator('[data-action="image.add"]').click(),
  ]);
  await chooser.setFiles({ name: 'q.png', mimeType: 'image/png', buffer: png });
  await expect.poll(async () => (await images(page)).length).toBe(1);
  const [img] = await images(page);
  expect(img.w / img.h).toBeCloseTo(2, 2);
  expect(img.w).toBeLessThanOrEqual(560);
  expect(
    await page.evaluate(() => (window as any).__tb.runtime.board.getState().selection.length),
  ).toBe(1);
});

test('paste an image from the clipboard (Ctrl+V), and drop an image file at the drop point', async ({
  page,
}) => {
  const png = [...(await pngBytes(page, 200, 200, 'blue'))];
  // הדבקה
  await page.evaluate((bytes) => {
    const dt = new DataTransfer();
    dt.items.add(new File([new Uint8Array(bytes)], 'shot.png', { type: 'image/png' }));
    document.body.dispatchEvent(
      new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }),
    );
  }, png);
  await expect.poll(async () => (await images(page)).length).toBe(1);

  // גרירה
  const box = (await page.getByTestId('board').boundingBox())!;
  await page.evaluate(
    ({ bytes, x, y }) => {
      const dt = new DataTransfer();
      dt.items.add(new File([new Uint8Array(bytes)], 'drop.png', { type: 'image/png' }));
      const board = document.querySelector('[data-testid=board]')!;
      board.dispatchEvent(
        new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true }),
      );
      board.dispatchEvent(
        new DragEvent('drop', {
          dataTransfer: dt,
          clientX: x,
          clientY: y,
          bubbles: true,
          cancelable: true,
        }),
      );
    },
    { bytes: png, x: box.x + 200, y: box.y + 200 },
  );
  await expect.poll(async () => (await images(page)).length).toBe(2);

  // הדבקה פנימית (אובייקטים מהלוח) עדיין עובדת ב-Ctrl+V
  await page.keyboard.press('Control+c');
  await page.keyboard.press('Control+v');
  await expect.poll(async () => (await images(page)).length).toBe(3);
});

test('images are saved with the lesson and exported to PDF as the original picture', async ({
  page,
}) => {
  const png = [...(await pngBytes(page, 300, 300, 'green'))];
  await page.evaluate((bytes) => {
    const dt = new DataTransfer();
    dt.items.add(new File([new Uint8Array(bytes)], 'g.png', { type: 'image/png' }));
    document.body.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true }));
  }, png);
  await expect.poll(async () => (await images(page)).length).toBe(1);
  await expect(page.getByTestId('save-status')).toHaveAttribute('data-status', 'saved');
  await page.reload();
  await expect.poll(async () => (await images(page)).length).toBe(1);

  await page.getByRole('button', { name: 'ניהול שיעורים וקבצים' }).click();
  const [dl] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'PDF של העמוד' }).click(),
  ]);
  const out = await PDFDocument.load(await readFile((await dl.path())!));
  const xo = out.getPage(0).node.Resources()!.lookup(PDFName.of('XObject'), PDFDict);
  const subtypes = xo
    .keys()
    .map((k) =>
      String((out.context.lookup(xo.get(k)) as PDFRawStream).dict.get(PDFName.of('Subtype'))),
    );
  expect(subtypes).toContain('/Image');
});

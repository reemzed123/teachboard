/* eslint-disable @typescript-eslint/no-explicit-any -- גישה לכלי הבדיקה window.__tb בתוך הדפדפן */
import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { PDFDocument, StandardFonts } from 'pdf-lib';

// בדיקות שלב 8: התקנה, שמירה מראש של כל הקבצים, פתיחת קבצים מ-Windows, ועבודה בלי אינטרנט.

async function walk(dir: string, base = dir): Promise<string[]> {
  const out: string[] = [];
  for (const name of await readdir(dir)) {
    const p = join(dir, name);
    if ((await stat(p)).isDirectory()) out.push(...(await walk(p, base)));
    else out.push(p.slice(base.length + 1).replaceAll('\\', '/'));
  }
  return out;
}

test('every file of the app is stored on the device in advance (nothing skipped)', async () => {
  const sw = await readFile('dist/sw.js', 'utf8');
  const cached = new Set([...sw.matchAll(/url:"([^"]+)"/g)].map((m) => m[1]));
  const files = (await walk('dist')).filter(
    (f) =>
      !f.endsWith('.map') && f !== 'sw.js' && !/^workbox-[\w-]+\.js$/.test(f) && !/LICENSE/.test(f),
  );
  const missing = files.filter((f) => !cached.has(f));
  expect(missing).toEqual([]);
});

test('the app can be installed and opens .board and PDF files from Windows', async ({ page }) => {
  const manifest = JSON.parse(await readFile('dist/manifest.webmanifest', 'utf8'));
  expect(manifest.display).toBe('standalone');
  const accepts = manifest.file_handlers.flatMap((h: any) => Object.values(h.accept).flat());
  expect(accepts).toEqual(expect.arrayContaining(['.board', '.pdf']));

  // הדמיה של "פתח באמצעות TeachBoard": Windows מעביר קובץ PDF לתוכנה
  const doc = await PDFDocument.create();
  doc.addPage([300, 200]).drawText('Hi', { font: await doc.embedFont(StandardFonts.Helvetica) });
  const bytes = [...(await doc.save())];
  await page.addInitScript((data: number[]) => {
    Object.defineProperty(window, 'launchQueue', {
      configurable: true,
      value: {
        setConsumer(cb: (p: any) => void) {
          const file = new File([new Uint8Array(data)], 'דף עבודה.pdf', {
            type: 'application/pdf',
          });
          setTimeout(() => cb({ files: [{ kind: 'file', getFile: async () => file }] }), 300);
        },
      },
    });
  }, bytes);
  await page.goto('/?debug=1');
  await expect(page.getByTestId('notice')).toContainText('דף עבודה');
  await expect(page.getByLabel('שם השיעור')).toHaveValue('דף עבודה');
});

test('settings show where lessons are stored', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'הגדרות' }).click();
  await expect(page.getByTestId('storage-status')).toContainText('שמורים במחשב');
});

test('offline: badge, PDF open + export, .board save and open – all without internet', async ({
  page,
  context,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true });
  });
  await page.goto('/?debug=1');
  await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    const sw = reg.active!;
    if (sw.state !== 'activated')
      await new Promise<void>((r) =>
        sw.addEventListener('statechange', () => sw.state === 'activated' && r()),
      );
  });
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByTestId('save-status')).toHaveAttribute('data-status', 'saved');
  await expect(page.getByTestId('offline-badge')).toBeVisible();

  // PDF: מציג ה-PDF (כולל קובצי העזר) נטען מהמחשב
  const doc = await PDFDocument.create();
  doc.addPage([595, 842]).drawText('Offline worksheet', {
    x: 50,
    y: 760,
    size: 24,
    font: await doc.embedFont(StandardFonts.Helvetica),
  });
  await page.getByRole('button', { name: 'PDF ומסמכים' }).click();
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('button', { name: 'פתיחת PDF כשיעור חדש' }).click(),
  ]);
  await chooser.setFiles({
    name: 'w.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(await doc.save()),
  });
  await expect(page.getByTestId('notice')).toContainText('נפתח');
  const [pdfDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'PDF של כל השיעור' }).click(),
  ]);
  const out = await PDFDocument.load(await readFile((await pdfDownload.path())!));
  expect(out.getPageCount()).toBe(1);

  // שמירה כקובץ שיעור ופתיחה מחדש
  await page.getByRole('button', { name: 'ניהול שיעורים וקבצים' }).click();
  const [saved] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'שמירה כקובץ שיעור' }).click(),
  ]);
  const [chooser2] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('button', { name: 'פתיחת קובץ שיעור' }).click(),
  ]);
  await chooser2.setFiles((await saved.path())!);
  await expect(page.getByTestId('notice')).toContainText('נפתח');
  const pdfPages = await page.evaluate(
    () =>
      (window as any).__tb.runtime.board.getState().doc.pages.filter((p: any) => p.background.pdf)
        .length,
  );
  expect(pdfPages).toBe(1);

  await context.setOffline(false);
  await expect(page.getByTestId('offline-badge')).toHaveCount(0);
});

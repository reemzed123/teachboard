import { expect, test, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

/** מציב פעולה בסרגל הגישה המהירה דרך ההגדרות. */
async function setQuickSlot(page: Page, slot: number, option: string) {
  await page.getByRole('button', { name: 'הגדרות' }).click();
  await page.getByLabel(`לחצן ${slot}`).selectOption({ label: option });
  await page.getByRole('button', { name: 'סגירת החלונית' }).click();
}

test('loads in Hebrew, right-to-left, with the local font', async ({ page }) => {
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('html')).toHaveAttribute('lang', 'he');
  await expect(page.getByText('TeachBoard').first()).toBeVisible();
  // טוענים את הגופן העברי ומוודאים שהוא זמין (מקובץ מקומי).
  const fontReady = await page.evaluate(async () => {
    await document.fonts.load('16px "Heebo Variable"', 'שלום');
    return document.fonts.check('16px "Heebo Variable"', 'שלום');
  });
  expect(fontReady).toBe(true);
});

// דרישת אופליין: האפליקציה לא פונה לשום שרת חיצוני (CDN, גופנים, אנליטיקה).
test('makes no requests to external hosts', async ({ page, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  const external: string[] = [];
  page.on('request', (req) => {
    const url = req.url();
    if (!url.startsWith(origin) && !url.startsWith('data:') && !url.startsWith('blob:')) {
      external.push(url);
    }
  });
  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: 'הגדרות' }).click();
  await page.getByRole('button', { name: 'מתמטיקה' }).click();
  expect(external).toEqual([]);
});

test('category bar is on the right side (RTL)', async ({ page }) => {
  const bar = await page.getByRole('navigation', { name: 'קטגוריות כלים' }).boundingBox();
  const vw = page.viewportSize()!.width;
  expect(bar!.x + bar!.width).toBeGreaterThan(vw - 5);
});

test('theme toggle switches and is remembered after reload', async ({ page }) => {
  await setQuickSlot(page, 5, 'מצב בהיר / כהה');
  const html = page.locator('html');
  const before = await html.getAttribute('data-theme');
  await page.locator('[data-action="view.toggleTheme"]').click();
  const after = await html.getAttribute('data-theme');
  expect(after).not.toBe(before);
  await page.reload();
  await expect(html).toHaveAttribute('data-theme', after!);
});

test('quick access buttons can be chosen in settings and are remembered', async ({ page }) => {
  await page.getByRole('button', { name: 'הגדרות' }).click();
  await page.getByLabel('לחצן 1').selectOption({ label: 'ריק' });
  await expect(page.locator('.tb-quick [data-action="view.toggleTheme"]')).toHaveCount(0);
  await page.getByLabel('לחצן 5').selectOption({ label: 'מצב בהיר / כהה' });
  await expect(page.locator('.tb-quick [data-action="view.toggleTheme"]')).toHaveCount(1);
  await page.reload();
  await expect(page.locator('.tb-quick [data-action]')).toHaveCount(4);
  await page.getByRole('button', { name: 'הגדרות' }).click();
  await expect(page.getByLabel('לחצן 1')).toHaveValue('');
  await expect(page.getByLabel('לחצן 5')).toHaveValue('view.toggleTheme');
});

test('hide-all-bars mode and restoring', async ({ page }) => {
  await setQuickSlot(page, 5, 'הסתרת כל הסרגלים');
  await page.locator('[data-action="view.focusMode"]').click();
  await expect(page.getByRole('navigation', { name: 'קטגוריות כלים' })).toHaveCount(0);
  await expect(page.locator('.tb-topbar')).toHaveCount(0);
  await page.getByRole('button', { name: 'הצגת הסרגלים' }).click();
  await expect(page.locator('.tb-topbar')).toBeVisible();
  // וגם Escape מחזיר
  await page.locator('[data-action="view.focusMode"]').click();
  await page.keyboard.press('Escape');
  await expect(page.locator('.tb-topbar')).toBeVisible();
});

test('category bar can be hidden and shown', async ({ page }) => {
  await setQuickSlot(page, 5, 'הצגת סרגל הקטגוריות');
  const nav = page.getByRole('navigation', { name: 'קטגוריות כלים' });
  await page.locator('[data-action="view.toggleCategoryBar"]').click();
  await expect(nav).toHaveCount(0);
  await page.locator('[data-action="view.toggleCategoryBar"]').click();
  await expect(nav).toBeVisible();
});

test('phone-width screen has no horizontal scroll and panel fits', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.getByRole('button', { name: 'הגדרות' }).click();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
  const panel = await page.getByRole('complementary', { name: 'הגדרות' }).boundingBox();
  expect(panel!.x).toBeGreaterThanOrEqual(0);
});

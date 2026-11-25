import { defineConfig, devices } from '@playwright/test';

// הבדיקות רצות מול גרסת הבנייה (dist), כמו שהמשתמש יקבל אותה.
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: { baseURL: 'http://localhost:4173', trace: 'off' },
  webServer: {
    command: 'pnpm preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: 'chrome', use: { ...devices['Desktop Chrome'] } },
    { name: 'chrome-touch', use: { ...devices['Desktop Chrome'], hasTouch: true } },
  ],
});

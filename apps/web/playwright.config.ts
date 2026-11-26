import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests against a running stack (API on :4000 with dev seed data, web on :3000).
 * Locally the installed Chrome is used; CI sets PW_CHANNEL= to use Playwright's Chromium.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
    ...devices['Pixel 7'],
    channel: process.env.PW_CHANNEL === '' ? undefined : (process.env.PW_CHANNEL ?? 'chrome'),
    geolocation: { latitude: 18.9672, longitude: 76.9531 },
    permissions: [],
  },
});

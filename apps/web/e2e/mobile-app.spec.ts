// Runtime smoke test of the Android app's screens through its Expo web export (an emulator is not needed).
// Opt-in: export with EXPO_PUBLIC_API_URL pointing at the API, serve it, and set MOBILE_WEB_URL.
import { expect, test } from '@playwright/test';

test.skip(!process.env.MOBILE_WEB_URL, 'Set MOBILE_WEB_URL to run the mobile app smoke test');
test.use({ baseURL: process.env.MOBILE_WEB_URL });

test('mobile app: language gate, explore, detail, login, contact, my listings, language', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.getByText('English', { exact: true }).click();
  await expect(page.getByText(/machines? found/)).toBeVisible({ timeout: 20_000 });
  await page.getByText('Combine harvester for soybean and wheat').click();
  await expect(page.getByText('Contact owner')).toBeVisible();
  await page.getByText('Contact owner').click();
  await expect(page.getByText('Please log in to continue.')).toBeVisible();
  await page.getByLabel('Mobile number').fill('7000000011');
  await page.getByLabel('Password').fill('demo-pass-2025');
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.getByTestId('show-number').click();
  await expect(page.getByText(/^\+917000000010$/)).toBeVisible();
  await page.goBack();
  await page.getByRole('tab', { name: /My listings/ }).click();
  await expect(page.getByText('My listings').first()).toBeVisible();
  await expect(page.getByText('Spraying drone, 10 litre tank')).toBeVisible();
  await page.getByRole('tab', { name: /Profile/ }).click();
  await page.getByText('हिन्दी').click();
  await expect(page.getByText('प्रोफ़ाइल').first()).toBeVisible();
  expect(errors).toEqual([]);
});

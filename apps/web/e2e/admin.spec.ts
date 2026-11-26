import { expect, test, type Page } from '@playwright/test';

/**
 * Needs an administrator created with the CLI (the only way to create one):
 *   ADMIN_MOBILE=... ADMIN_NAME=... ADMIN_PASSWORD=... pnpm --filter @yantramitra/api admin create
 * then E2E_ADMIN_MOBILE / E2E_ADMIN_PASSWORD set to the same values. Uses the development sample data.
 */
const mobile = process.env.E2E_ADMIN_MOBILE;
const password = process.env.E2E_ADMIN_PASSWORD;
test.skip(!mobile || !password, 'Set E2E_ADMIN_MOBILE and E2E_ADMIN_PASSWORD to run admin tests');

async function login(page: Page) {
  await page.goto('/en/login?next=/admin');
  const form = page.getByTestId('login-form');
  await form.getByLabel('Mobile number').fill(mobile!);
  await form.getByLabel('Password', { exact: true }).fill(password!);
  await form.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByTestId('admin-metrics')).toBeVisible();
}

test('ordinary users cannot open the admin area', async ({ page }) => {
  const number = `9${String(Date.now()).slice(-9)}`;
  await page.goto('/en/register');
  const form = page.getByTestId('register-form');
  await form.getByLabel('Full name').fill('Not An Admin');
  await form.getByLabel('Mobile number').fill(number);
  await form.getByLabel('Password', { exact: true }).fill('ordinary-user-1');
  await form.getByLabel('Confirm password').fill('ordinary-user-1');
  await form.getByRole('button', { name: 'Create account' }).click();
  await page.waitForURL((u) => !u.pathname.includes('/register'));
  await page.goto('/en/admin');
  await expect(page.getByText('You need administrator access')).toBeVisible();
});

test('admin suspends and restores a listing, sees it in the audit log', async ({ page }) => {
  await login(page);
  await page.getByRole('link', { name: 'Listings' }).click();
  const row = page.getByTestId('admin-listing').filter({ hasText: 'Diesel water pump 5 HP' });
  await row.getByRole('button', { name: 'Suspend' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Reason').fill('E2E moderation check');
  await dialog.getByRole('button', { name: 'Suspend' }).click();
  await expect(row.getByText('Suspended')).toBeVisible();
  await expect(row.getByText('E2E moderation check')).toBeVisible();
  await row.getByRole('button', { name: 'Restore' }).click();
  await expect(row.getByText('Available')).toBeVisible();
  await page.getByRole('link', { name: 'Audit log' }).click();
  await expect(page.getByText('listing.restore').first()).toBeVisible();
  await expect(page.getByText('listing.suspend').first()).toBeVisible();
});

test('admin issues a temporary password that the user must change', async ({ page, browser }) => {
  await login(page);
  await page.getByRole('link', { name: 'Users' }).click();
  await page.getByLabel('Search name or mobile').fill('7000000014');
  const row = page.getByTestId('admin-user').filter({ hasText: '+917000000014' });
  await row.getByRole('button', { name: 'Temporary password' }).click();
  await page.getByTestId('confirm-button').click();
  const temp = (await page.getByTestId('temp-password').textContent())!.trim();
  expect(temp).toMatch(/^[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}$/);

  const user = await browser.newPage();
  await user.goto('/en/login');
  const form = user.getByTestId('login-form');
  await form.getByLabel('Mobile number').fill('7000000014');
  await form.getByLabel('Password', { exact: true }).fill(temp);
  await form.getByRole('button', { name: 'Log in' }).click();
  await expect(user.getByText('You logged in with a temporary password')).toBeVisible();
  const change = user.getByTestId('change-password-form');
  await change.getByLabel('Current password').fill(temp);
  await change.getByLabel('New password').fill('demo-pass-2025');
  await change.getByLabel('Confirm password').fill('demo-pass-2025');
  await expect(change.getByRole('button', { name: 'Change password' })).toBeEnabled();
  await change.getByRole('button', { name: 'Change password' }).click();
  // "demo-pass-2025" is the previous password: allowed, since the temporary one is what must change.
  await user.waitForURL(/\/en$/);
  await user.close();
});

test('admin adds an operation and it appears for everyone', async ({ page }) => {
  const slug = `e2e-op-${Date.now()}`;
  await login(page);
  await page.getByRole('link', { name: 'Catalogue' }).click();
  await page.getByRole('tab', { name: 'Operations' }).click();
  await page.getByTestId('catalogue-add').click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('URL name (slug)').fill(slug);
  await dialog.getByLabel('Name (English)').fill('E2E mulching');
  await dialog.getByLabel('Name (Marathi)').fill('आच्छादन');
  await dialog.getByLabel('Name (Hindi)').fill('मल्चिंग');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText(slug)).toBeVisible();
  const ops = await page.request.get('/api/v1/operations');
  expect((await ops.json()).some((o: { slug: string }) => o.slug === slug)).toBe(true);
});

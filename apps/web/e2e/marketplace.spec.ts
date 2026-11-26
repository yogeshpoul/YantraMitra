import { expect, test, type Page } from '@playwright/test';

const mobile = () => `9${String(Date.now()).slice(-9)}`;
const PASSWORD = 'shetkari-e2e-42';

async function registerUser(page: Page, next?: string) {
  const number = mobile();
  await page.goto(`/en/register${next ? `?next=${encodeURIComponent(next)}` : ''}`);
  const form = page.getByTestId('register-form');
  await form.getByLabel('Full name').fill('E2E Farmer');
  await form.getByLabel('Mobile number').fill(number);
  await form.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await form.getByLabel('Confirm password').fill(PASSWORD);
  await form.getByLabel('Preferred language').selectOption('en');
  await form.getByRole('button', { name: 'Create account' }).click();
  await page.waitForURL((u) => !u.pathname.includes('/register'));
  return number;
}

test.describe('guest', () => {
  test('browses without logging in and never sees a phone number', async ({ page }) => {
    await page.goto('/en');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Find farm machinery');
    await page.getByRole('link', { name: 'Explore' }).first().click();
    await expect(page.getByTestId('results-count')).toContainText(/machines? found/);
    const card = page.getByTestId('listing-card').first();
    await card.getByRole('link').click();
    await expect(page.getByTestId('detail-price')).toBeVisible();
    const html = await page.content();
    expect(html).not.toMatch(/\+91\s?7000000/);
    expect(html).not.toContain('Demo Owner');
    await page.getByTestId('login-to-contact').click();
    await expect(page).toHaveURL(/\/en\/login\?next=/);
  });

  test('filters by category and searches by place', async ({ page }) => {
    await page.goto('/en/equipment');
    await page.getByRole('button', { name: 'Filters' }).click();
    await page.getByTestId('filter-category').selectOption('spraying');
    await page.getByRole('button', { name: 'Show results' }).click();
    await expect(page).toHaveURL(/category=spraying/);
    await expect(page.getByTestId('listing-card')).toHaveCount(2);

    await page.goto('/en/equipment?place=pune&radiusKm=50');
    await expect(page.getByTestId('location-label')).toContainText('Pune');
    await expect(page.getByTestId('listing-card')).toHaveCount(2);
    await expect(page.getByTestId('listing-card').first()).toContainText('km away');
  });

  test('manual location works when GPS permission is denied', async ({ page }) => {
    await page.goto('/en');
    await page.getByRole('button', { name: 'Change' }).click();
    await page.getByRole('button', { name: 'Use my current location' }).click();
    await expect(page.getByText('Location permission was not given')).toBeVisible();
    await page.getByRole('combobox', { name: /Village/ }).fill('Nashik');
    await page.getByRole('listbox').getByRole('option').first().click();
    await expect(page.getByTestId('location-label')).toContainText('Nashik');
    await expect(page.getByRole('heading', { name: /Equipment near Nashik/ })).toBeVisible();
  });

  test('switches language and remembers it', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'mr');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('शेती यंत्रे');
    await page.getByTestId('language-select').selectOption('hi');
    await expect(page).toHaveURL(/\/hi$/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('खेती मशीनें');
    await page.goto('/');
    await expect(page).toHaveURL(/\/hi$/);
    await page.getByTestId('language-select').selectOption('mr');
    await expect(page.locator('html')).toHaveAttribute('lang', 'mr');
  });
});

test.describe('signed-in user', () => {
  test('registers from a listing, returns to it and reveals the contact', async ({ page }) => {
    await page.goto('/en/equipment?category=harvesting');
    await page.getByTestId('listing-card').first().getByRole('link').click();
    await page.waitForURL(/\/equipment\/harvesting\//);
    const detailUrl = page.url();
    await page.getByTestId('login-to-contact').click();
    await page.getByRole('link', { name: 'Create account' }).click();
    await registerUser(page, new URL(detailUrl).pathname);
    await expect(page).toHaveURL(detailUrl);
    await page.getByTestId('show-number').click();
    await expect(page.getByTestId('owner-phone')).toHaveText(/^\+917000000/);
    await expect(page.getByRole('link', { name: /Call Demo/ })).toHaveAttribute('href', /^tel:\+91/);
    await page.getByTestId('favorite-button').click();
    await page.goto('/en/saved');
    await expect(page.getByTestId('listing-card')).toHaveCount(1);
  });

  test('adds, edits, relocates, deactivates and deletes a listing', async ({ page }) => {
    await registerUser(page);
        await page.goto('/en/listings/new');
    const wizard = page.getByTestId('listing-wizard');

    await wizard.getByTestId('wizard-category').selectOption({ label: 'Tillage equipment' });
    await wizard.getByTestId('wizard-type').selectOption({ label: 'Rotavator' });
    await wizard.getByLabel('Listing title').fill('E2E rotavator for hire');
    await page.getByTestId('wizard-next').click();
    await wizard.getByLabel('Rotavating').check();
    await page.getByTestId('wizard-next').click();
    await wizard.getByLabel('Per acre').check();
    await page.getByTestId('wizard-price').fill('1100');
    await page.getByTestId('wizard-next').click();
    await page.getByTestId('wizard-fuelTerm').selectOption('included');
    await page.getByTestId('wizard-operatorTerm').selectOption('included');
    await page.getByTestId('wizard-transportTerm').selectOption('negotiated');
    await page.getByTestId('wizard-next').click();
    // Location step: nothing chosen yet → validation stops the user.
    await page.getByTestId('wizard-next').click();
    await expect(wizard.getByText('Choose a location').first()).toBeVisible();
    await page.getByTestId('home-location').getByRole('combobox', { name: /Village/ }).fill('Parbhani');
    await page.getByRole('listbox').getByRole('option').first().click();
    await expect(page.getByTestId('home-location').getByTestId('picked-location')).toContainText('Parbhani');
    await wizard.getByLabel('Place description (private)').fill('Behind my house, private');
    await page.getByTestId('wizard-next').click();
    await page.getByTestId('wizard-next').click();
    await expect(page.getByTestId('wizard-review')).toContainText('E2E rotavator for hire');
    await page.getByTestId('wizard-submit').click();

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('E2E rotavator for hire');
    await expect(page.getByTestId('detail-price')).toContainText('1,100');
    expect(await page.content()).not.toContain('Behind my house');

    await page.goto('/en/my-listings');
    const item = page.getByTestId('my-listing').filter({ hasText: 'E2E rotavator for hire' });
    await item.getByRole('link', { name: 'Edit' }).click();
    await page.getByLabel('Listing title').fill('E2E rotavator, edited');
    for (let i = 0; i < 6; i++) await page.getByTestId('wizard-next').click();
    await page.getByTestId('wizard-submit').click();
    await expect(page).toHaveURL(/my-listings/);
    await expect(page.getByTestId('my-listing').filter({ hasText: 'E2E rotavator, edited' })).toBeVisible();

    const edited = page.getByTestId('my-listing').filter({ hasText: 'E2E rotavator, edited' });
    await edited.getByRole('link', { name: 'Update location' }).click();
    await page.getByTestId('update-location').getByRole('combobox', { name: /Village/ }).fill('Pune');
    await page.getByRole('listbox').getByRole('option').first().click();
    await page.getByTestId('save-location').click();
    await expect(page.getByText('Current location updated.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Recent locations' })).toBeVisible();

    await page.goto('/en/my-listings');
    const row = page.getByTestId('my-listing').filter({ hasText: 'E2E rotavator, edited' });
    await row.getByTestId('deactivate').click();
    await expect(row.getByText('Inactive')).toBeVisible();
    await row.getByRole('button', { name: 'Delete' }).click();
    await page.getByTestId('confirm-button').click();
    await expect(page.getByTestId('my-listing').filter({ hasText: 'E2E rotavator, edited' })).toHaveCount(0);
  });

  test('logs out and logs back in', async ({ page }) => {
    const number = await registerUser(page);
    await page.goto('/en/profile');
    await page.getByTestId('logout').click();
    await page.goto('/en/login');
    const form = page.getByTestId('login-form');
    await form.getByLabel('Mobile number').fill(number);
    await form.getByLabel('Password', { exact: true }).fill('wrong-password');
    await form.getByRole('button', { name: 'Log in' }).click();
    await expect(page.getByText('Incorrect mobile number or password.')).toBeVisible();
    await form.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await form.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/en$/);
    await page.goto('/en/my-listings');
    await expect(page.getByRole('heading', { name: 'My listings' })).toBeVisible();
  });
});

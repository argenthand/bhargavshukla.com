import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const pages = ['/', '/writing/sample-post/'];

test('the skip link is the first tab stop and moves focus to the main content', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Skip to content' });
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#main$/);
});

test('every page has a header with navigation and a footer', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: /Bhargav Shukla/ }).first()).toBeVisible();
  const nav = page.getByRole('navigation', { name: 'Primary' });
  for (const name of ['Writing', 'Snippets', 'Resume']) {
    await expect(nav.getByRole('link', { name })).toBeVisible();
  }
  await expect(page.getByRole('contentinfo')).toBeVisible();
});

test('a Post renders at /writing/<slug> with its title and body', async ({ page }) => {
  await page.goto('/writing/sample-post');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('A sample Post about leading a team');
  await expect(page.getByText('This is the opening paragraph of the sample Post.')).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'First section' })).toBeVisible();
});

for (const path of pages) {
  test(`${path} has no WCAG 2.2 AA violations and no console errors`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => message.type() === 'error' && errors.push(message.text()));

    await page.goto(path);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();

    expect(results.violations).toEqual([]);
    expect(errors).toEqual([]);
  });
}

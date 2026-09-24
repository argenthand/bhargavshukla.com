import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const pages = ['/', '/writing/sample-post/', '/writing/sample-book-review/'];

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

test('a Post shows breadcrumb, Summary, author, dates, reading time and Category, and no tags', async ({ page }) => {
  await page.goto('/writing/sample-post');
  const article = page.getByRole('article');
  await expect(article.getByRole('link', { name: 'Writing' })).toBeVisible();
  await expect(article.getByText('Sample content used by tests. It is not real writing.')).toBeVisible();
  await expect(article.getByText('By Bhargav Shukla')).toBeVisible();
  await expect(article.getByText('September 1, 2026')).toBeVisible();
  await expect(article.getByText('Updated September 10, 2026')).toBeVisible();
  await expect(article.getByText(/\d+ min read/)).toBeVisible();
  await expect(article.getByText('Leadership', { exact: true })).toBeVisible();
  await expect(page.getByText(/tags?:/i)).toHaveCount(0);
});

test('the Updated date is hidden when there is none', async ({ page }) => {
  await page.goto('/writing/sample-book-review');
  await expect(page.getByText(/^Updated/)).toHaveCount(0);
});

test('a Book Review shows the book title and author', async ({ page }) => {
  await page.goto('/writing/sample-book-review');
  await expect(page.getByText('The Sample Book', { exact: true })).toBeVisible();
  await expect(page.getByText(/by Sample Author/)).toBeVisible();
});

test('a Post body renders callouts, footnotes, tables and images with alt text', async ({ page }) => {
  await page.goto('/writing/sample-post');
  await expect(page.locator('.callout')).toContainText('This is a callout.');
  await expect(page.getByRole('table')).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Twice weekly' })).toBeVisible();
  await expect(page.getByText('This is a footnote.')).toBeVisible();
  await expect(page.getByRole('img', { name: 'A small sample icon' })).toBeVisible();
});

test('code blocks are highlighted and the copy button copies the code and confirms it', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/writing/sample-post');
  await expect(page.locator('pre.astro-code span[style]').first()).toBeVisible();

  const button = page.getByRole('button', { name: 'Copy code' });
  await button.focus();
  await page.keyboard.press('Enter');

  await expect(button).toHaveText('Copied');
  await expect(page.getByRole('status')).toHaveText('Code copied to clipboard');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('export function greet');
});

test('Drafts and Scheduled Posts are not built, even a Draft with a past Publish Date', async ({ request }) => {
  expect((await request.get('/writing/sample-draft/')).status()).toBe(404);
  expect((await request.get('/writing/sample-scheduled/')).status()).toBe(404);
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

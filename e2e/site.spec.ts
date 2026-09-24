import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const pages = ['/', '/writing/', '/writing/page/2/', '/writing/?q=zzz', '/writing/sample-post/', '/writing/sample-book-review/', '/snippets/', '/snippets/#retry-with-backoff'];

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

  await expect(page.locator('.code-language')).toHaveText('ts');

  const button = page.getByRole('button', { name: 'Copy code' });
  await button.focus();
  await page.keyboard.press('Enter');

  await expect(button).toHaveText('Copied');
  await expect(page.getByRole('status')).toHaveText('Code copied to clipboard');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('export function greet');
});

test.describe('Writing list', () => {
  // Sample settings set a page size of 2 and there are 3 published Posts, so there are 2 pages.
  test.use({ javaScriptEnabled: false });

  test('lists published Posts newest first with date, title and Category, and a range indicator', async ({ page }) => {
    await page.goto('/writing');
    const rows = page.getByRole('listitem').filter({ has: page.getByRole('link', { name: /sample/i }) });
    await expect(page.getByRole('link', { name: 'A sample Post about leading a team' })).toBeVisible();
    const titles = await page.locator('.post-list .post-title').allTextContents();
    expect(titles).toEqual(['A sample Post about leading a team', 'A sample Book Review']);
    await expect(rows.first()).toContainText('September 1, 2026');
    await expect(rows.first()).toContainText('Leadership');
    await expect(page.getByText('1–2 of 3', { exact: true })).toBeVisible();
  });

  test('moves between pages with Next, Previous and page numbers, without JavaScript', async ({ page }) => {
    await page.goto('/writing');
    const pagination = page.getByRole('navigation', { name: 'Pagination' });
    await expect(pagination.getByRole('link', { name: 'Previous' })).toHaveCount(0);
    await expect(pagination.getByRole('link', { name: 'Page 1' })).toHaveAttribute('aria-current', 'page');

    await pagination.getByRole('link', { name: 'Next' }).click();
    await expect(page).toHaveURL(/\/writing\/page\/2\/?$/);
    await expect(page.getByText('3 of 3', { exact: true })).toBeVisible();
    await expect(page.locator('.post-list .post-title')).toHaveText(['A sample older Post about engineering']);
    await expect(pagination.getByRole('link', { name: 'Next' })).toHaveCount(0);
    await expect(pagination.getByRole('link', { name: 'Page 2' })).toHaveAttribute('aria-current', 'page');

    await pagination.getByRole('link', { name: 'Previous' }).click();
    await expect(page).toHaveURL(/\/writing\/?$/);
    await pagination.getByRole('link', { name: 'Page 2' }).click();
    await expect(page).toHaveURL(/\/writing\/page\/2\/?$/);
  });

  test('hides the search controls, which need JavaScript', async ({ page }) => {
    await page.goto('/writing');
    await expect(page.getByRole('searchbox')).toBeHidden();
  });

  test('links each row to its Post, and Drafts and Scheduled Posts never appear', async ({ page }) => {
    await page.goto('/writing');
    await page.getByRole('link', { name: 'A sample Book Review' }).click();
    await expect(page).toHaveURL(/\/writing\/sample-book-review\/?$/);
    await page.goto('/writing');
    await expect(page.getByText(/sample Draft|Scheduled Post/)).toHaveCount(0);
  });
});

test.describe('Writing search, filter and sort', () => {
  const titles = (page: import('@playwright/test').Page) => page.locator('.post-list .post-title');
  const pagination = (page: import('@playwright/test').Page) => page.getByRole('navigation', { name: 'Pagination' });

  test('searches titles across all pages and puts the state in the URL', async ({ page }) => {
    await page.goto('/writing');
    await page.getByRole('searchbox', { name: 'Search titles' }).fill('older');
    await expect(page).toHaveURL(/\/writing\/?\?q=older$/);
    await expect(titles(page)).toHaveText(['A sample older Post about engineering']);
    await expect(page.getByText('1 of 1', { exact: true })).toBeVisible();

    // "sample" appears in all three titles, including the one that is only on page 2.
    await page.getByRole('searchbox', { name: 'Search titles' }).fill('sample');
    await expect(page.getByText('1–2 of 3', { exact: true })).toBeVisible();
    await expect(pagination(page)).toBeVisible();
  });

  test('filters by Category and sorts oldest first, combined with search', async ({ page }) => {
    await page.goto('/writing');
    await page.getByRole('combobox', { name: 'Category' }).selectOption('books');
    await expect(page).toHaveURL(/\?category=books$/);
    await expect(titles(page)).toHaveText(['A sample Book Review']);

    await page.getByRole('combobox', { name: 'Category' }).selectOption('');
    await page.getByRole('combobox', { name: 'Sort' }).selectOption('oldest');
    await expect(page).toHaveURL(/\?sort=oldest$/);
    await expect(titles(page)).toHaveText(['A sample older Post about engineering', 'A sample Book Review']);

    await page.getByRole('searchbox', { name: 'Search titles' }).fill('review');
    await expect(page).toHaveURL(/\?q=review&sort=oldest$/);
    await expect(titles(page)).toHaveText(['A sample Book Review']);
  });

  test('any change returns to page 1, and the back button restores the previous state', async ({ page }) => {
    await page.goto('/writing');
    await page.getByRole('searchbox', { name: 'Search titles' }).fill('sample');
    await expect(page).toHaveURL(/\?q=sample$/);

    await pagination(page).getByRole('link', { name: 'Next' }).click();
    await expect(page).toHaveURL(/\?q=sample&page=2$/);
    await expect(titles(page)).toHaveText(['A sample older Post about engineering']);

    await page.getByRole('combobox', { name: 'Sort' }).selectOption('oldest');
    await expect(page).toHaveURL(/\?q=sample&sort=oldest$/);
    await expect(page.getByText('1–2 of 3', { exact: true })).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL(/\?q=sample&page=2$/);
    await expect(titles(page)).toHaveText(['A sample older Post about engineering']);
    await expect(page.getByRole('combobox', { name: 'Sort' })).toHaveValue('newest');

    await page.goBack();
    await expect(page).toHaveURL(/\?q=sample$/);
    await expect(page.getByText('1–2 of 3', { exact: true })).toBeVisible();

    await page.goForward();
    await expect(page).toHaveURL(/\?q=sample&page=2$/);
  });

  test('restores the controls and results from a shared URL', async ({ page }) => {
    await page.goto('/writing?q=sample&category=leadership&sort=oldest');
    await expect(page.getByRole('searchbox', { name: 'Search titles' })).toHaveValue('sample');
    await expect(page.getByRole('combobox', { name: 'Category' })).toHaveValue('leadership');
    await expect(page.getByRole('combobox', { name: 'Sort' })).toHaveValue('oldest');
    await expect(titles(page)).toHaveText(['A sample Post about leading a team']);

    await page.goto('/writing?page=2');
    await expect(titles(page)).toHaveText(['A sample older Post about engineering']);
  });

  test('corrects a page past the end in the URL', async ({ page }) => {
    await page.goto('/writing?page=99');
    await expect(page).toHaveURL(/\?page=2$/);
    await expect(titles(page)).toHaveText(['A sample older Post about engineering']);
  });

  test('re-announces the count when only the sort changes', async ({ page }) => {
    await page.goto('/writing?q=sample');
    const status = page.getByRole('status');
    await page.getByRole('combobox', { name: 'Sort' }).selectOption('oldest');
    await expect(status).toHaveText('Showing 1–2 of 3 posts');
  });

  test('searching from a numbered page starts from page 1 of the results', async ({ page }) => {
    await page.goto('/writing/page/2');
    await page.getByRole('searchbox', { name: 'Search titles' }).fill('sample');
    await expect(page).toHaveURL(/\/writing\/?\?q=sample$/);
    await expect(page.getByText('1–2 of 3', { exact: true })).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/\/writing\/page\/2\/?$/);
    await expect(titles(page)).toHaveText(['A sample older Post about engineering']);
  });

  test('shows "No posts match" with a Clear filters button that resets search and Category', async ({ page }) => {
    await page.goto('/writing');
    await page.getByRole('combobox', { name: 'Category' }).selectOption('books');
    await page.getByRole('searchbox', { name: 'Search titles' }).fill('zzz');
    await expect(page.locator('#writing-results').getByText('No posts match.')).toBeVisible();
    await expect(titles(page)).toHaveCount(0);

    await page.getByRole('button', { name: 'Clear filters' }).click();
    await expect(page).toHaveURL(/\/writing\/?$/);
    await expect(page.getByRole('searchbox', { name: 'Search titles' })).toHaveValue('');
    await expect(page.getByRole('combobox', { name: 'Category' })).toHaveValue('');
    await expect(page.getByRole('searchbox', { name: 'Search titles' })).toBeFocused();
    await expect(titles(page)).toHaveText(['A sample Post about leading a team', 'A sample Book Review']);
  });

  test('announces the result count to screen readers when results change', async ({ page }) => {
    await page.goto('/writing');
    const status = page.getByRole('status');
    await expect(status).toHaveText('');
    await page.getByRole('searchbox', { name: 'Search titles' }).fill('review');
    await expect(status).toHaveText('Showing 1 of 1 post');
    await page.getByRole('searchbox', { name: 'Search titles' }).fill('zzz');
    await expect(status).toHaveText('No posts match.');
  });

  test('paging with the keyboard keeps focus in the list', async ({ page }) => {
    await page.goto('/writing');
    await page.getByRole('searchbox', { name: 'Search titles' }).fill('sample');
    await expect(page).toHaveURL(/\?q=sample$/);
    await pagination(page).getByRole('link', { name: 'Next' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#writing-results')).toBeFocused();
  });
});

test.describe('Snippets', () => {
  const snippet = (page: import('@playwright/test').Page, id: string) => page.locator(`#${id}`);

  test('lists published Snippets newest first with explanation, language, date and line count', async ({ page }) => {
    await page.goto('/snippets');
    await expect(page.getByRole('heading', { level: 1, name: 'Snippets' })).toBeVisible();
    await expect(page.getByText('2 snippets', { exact: true })).toBeVisible();
    await expect(page.locator('.snippet-title-link')).toHaveText(['Retry with exponential backoff', 'Debounce a function']);

    const debounce = snippet(page, 'debounce');
    await expect(debounce.getByText('Delay a call until the input has stopped changing.')).toBeVisible();
    await expect(debounce.locator('.snippet-meta')).toContainText('ts');
    await expect(debounce.locator('.snippet-meta')).toContainText('August 20, 2026');
    await expect(debounce.locator('.snippet-meta')).toContainText('7 lines');
    // The Updated date replaces the date when it is later than the Publish Date.
    await expect(snippet(page, 'retry-with-backoff').locator('.snippet-meta')).toContainText('Updated September 12, 2026');
    await expect(snippet(page, 'retry-with-backoff').locator('.snippet-meta')).toContainText('19 lines');
  });

  test('never shows Drafts or Scheduled Snippets, and has no pages of its own', async ({ page, request }) => {
    await page.goto('/snippets');
    await expect(page.getByText(/sample Draft Snippet|sample Scheduled Snippet/)).toHaveCount(0);
    expect((await request.get('/snippets/debounce/')).status()).toBe(404);
  });

  test('every Snippet has a copy button that copies its code and confirms it', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/snippets');
    // A collapsed Snippet's copy button lives in its code panel (as in the mockup), so it appears on expanding.
    await expect(page.getByRole('button', { name: /^Copy / })).toHaveCount(1);
    await page.getByRole('button', { name: 'Show code: Retry with exponential backoff' }).click();
    await expect(page.getByRole('button', { name: /^Copy / })).toHaveCount(2);

    const button = page.getByRole('button', { name: 'Copy Debounce a function' });
    await button.focus();
    await page.keyboard.press('Enter');
    await expect(button).toHaveText('Copied');
    await expect(page.getByRole('status')).toHaveText('Copied Debounce a function');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('export function debounce');
  });

  test('Snippets longer than 15 lines start collapsed and expand from the keyboard', async ({ page }) => {
    await page.goto('/snippets');
    const long = snippet(page, 'retry-with-backoff');
    const toggle = long.getByRole('button', { name: 'Show code: Retry with exponential backoff' });

    await expect(long.locator('pre')).toBeHidden();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(snippet(page, 'debounce').locator('pre')).toBeVisible();
    await expect(snippet(page, 'debounce').getByRole('button', { name: /Show code/ })).toHaveCount(0);

    await toggle.focus();
    await page.keyboard.press('Enter');
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(long.locator('pre')).toBeVisible();

    await page.keyboard.press('Space');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(long.locator('pre')).toBeHidden();
  });

  test('a Snippet title is a link to itself and copies that link', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/snippets');
    const title = page.getByRole('link', { name: 'Debounce a function' });
    await expect(title).toHaveAttribute('href', '#debounce');
    await title.click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/\/snippets\/?#debounce$/);
    await expect(page.getByRole('status')).toHaveText('Link to Debounce a function copied');
  });

  test('arriving on a Snippet link expands it, focuses it and briefly highlights it', async ({ page }) => {
    await page.goto('/snippets#retry-with-backoff');
    const target = snippet(page, 'retry-with-backoff');
    await expect(target.locator('pre')).toBeVisible();
    await expect(target).toBeInViewport();
    await expect(target).toBeFocused();
    await expect(target).toHaveClass(/is-highlighted/);
    await expect(target).not.toHaveClass(/is-highlighted/, { timeout: 5000 });
  });

  test('the highlight still happens, without animation, when reduced motion is preferred', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/snippets#debounce');
    await expect(snippet(page, 'debounce')).toHaveClass(/is-highlighted/);
    const transition = await snippet(page, 'debounce').evaluate((node) => getComputedStyle(node).transitionDuration);
    expect(transition).toBe('0s');
  });

  test('a malformed fragment does not break the page', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/snippets#%E0%A4%A');
    await page.getByRole('link', { name: 'Debounce a function' }).click();
    expect(errors).toEqual([]);
  });

  test('following a Snippet link on the page also reveals it', async ({ page }) => {
    await page.goto('/snippets');
    await page.evaluate(() => (location.hash = '#retry-with-backoff'));
    await expect(snippet(page, 'retry-with-backoff').locator('pre')).toBeVisible();
    await expect(snippet(page, 'retry-with-backoff')).toHaveClass(/is-highlighted/);
  });

  test.describe('without JavaScript', () => {
    test.use({ javaScriptEnabled: false });

    test('every Snippet is shown in full, with no controls that need JavaScript', async ({ page }) => {
      await page.goto('/snippets');
      await expect(page.locator('.snippet pre')).toHaveCount(2);
      await expect(page.locator('.snippet pre').first()).toBeVisible();
      await expect(page.getByRole('button', { name: /Copy|Show code/ })).toHaveCount(0);
    });
  });
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

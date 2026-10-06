import { describe, expect, it } from 'vitest';
import { firstParagraph, renderMarkdown, slugify } from '../../server/markdown';

describe('slugify', () => {
	it('makes URL-safe ids', () => {
		expect(slugify('Your calendar is the new codebase')).toBe('your-calendar-is-the-new-codebase');
		expect(slugify('Café & “quotes”!')).toBe('cafe-quotes');
		expect(slugify('???')).toBe('section');
	});
});

describe('renderMarkdown', () => {
	it('gives h2/h3 ids, focusable for the ToC, and lists them', () => {
		const { html, headings } = renderMarkdown(
			'# Title\n\n## First *part*\n\n### Detail\n\n## First part'
		);
		expect(headings).toEqual([
			{ id: 'first-part', text: 'First part', level: 2 },
			{ id: 'detail', text: 'Detail', level: 3 },
			{ id: 'first-part-2', text: 'First part', level: 2 }
		]);
		expect(html).toContain('<h2 id="first-part" tabindex="-1">First <em>part</em></h2>');
		expect(html).toContain('<h1>Title</h1>');
	});

	it('adds a section link to h2/h3 only when asked, keeping it out of the ToC text', () => {
		const md = '# Title\n\n## First *part*\n\n### Detail';
		expect(renderMarkdown(md).html).not.toContain('data-heading-link');

		const { html, headings } = renderMarkdown(md, { headingLinks: true });
		expect(html).toContain(
			'<h2 id="first-part" tabindex="-1">First <em>part</em><a href="#first-part" data-heading-link class="heading-link not-prose" aria-label="Copy link to this section">#</a></h2>'
		);
		expect(html).toContain('<a href="#detail" data-heading-link');
		expect(html).toContain('<h1>Title</h1>');
		expect(headings.map((h) => h.text)).toEqual(['First part', 'Detail']);
	});

	it('gives the Copy button a check icon for its confirmation', () => {
		const { html } = renderMarkdown('```ts\nconst a = 1;\n```');
		expect(html).toMatch(/<button[^>]*data-copy[^>]*><svg data-copy-icon[^>]*>/);
		expect(html).toContain('<span data-copy-label>Copy</span>');
	});

	it('highlights code with both themes and a filename header', () => {
		const { html } = renderMarkdown('```ts rotation.ts\nconst a = 1;\n```');
		expect(html).toContain('class="shiki shiki-themes github-light github-dark');
		expect(html).toContain('--shiki-dark');
		expect(html).toContain('rotation.ts');
		expect(html).toContain('TypeScript');
		expect(html).toContain('data-copy');
	});

	it('highlights C#', () => {
		expect(renderMarkdown('```csharp\nvar x = 1;\n```').html).toContain('C#');
	});

	it('falls back to plain text for unknown languages', () => {
		const { html } = renderMarkdown('```brainfuck\n+++\n```');
		expect(html).toContain('+++');
		expect(html).toContain('brainfuck');
	});

	it('wraps tables so they scroll, and lazy-loads images', () => {
		const { html } = renderMarkdown('| a | b |\n| - | - |\n| 1 | 2 |\n\n![Alt](/x.png)');
		expect(html).toMatch(/<div class="overflow-x-auto"><table>/);
		expect(html).toContain('<img src="/x.png" alt="Alt" loading="lazy" decoding="async">');
	});

	it('turns an image with a credit line under it into a captioned figure', () => {
		const { html } = renderMarkdown(
			'![Desk](https://images.unsplash.com/photo-1)\n*Photo by [Jane](https://unsplash.com/@jane) on [Unsplash](https://unsplash.com)*'
		);
		expect(html).toMatch(/^<figure><img src="https:\/\/images\.unsplash\.com\/photo-1\?w=1280/);
		expect(html).toContain('srcset="https://images.unsplash.com/photo-1?w=640');
		expect(html).toContain(
			'<figcaption>Photo by <a href="https://unsplash.com/@jane">Jane</a> on <a href="https://unsplash.com">Unsplash</a></figcaption></figure>'
		);
	});

	it('leaves other images and paragraphs alone', () => {
		const { html } = renderMarkdown('![A](/a.png)\n\nJust *text* here.');
		expect(html).toContain('<p><img src="/a.png" alt="A" loading="lazy" decoding="async"></p>');
		expect(html).toContain('<p>Just <em>text</em> here.</p>');
	});
});

describe('firstParagraph', () => {
	it('takes the first paragraph as plain text', () => {
		expect(firstParagraph('Hello **there**, see [my site](https://x.y).\n\nSecond one.')).toBe(
			'Hello there, see my site.'
		);
	});

	it('cuts long text at a word boundary to fit a meta description', () => {
		const text = firstParagraph('word '.repeat(60), 30);
		expect(text.length).toBeLessThanOrEqual(30);
		expect(text).toBe('word word word word word word…');
	});
});

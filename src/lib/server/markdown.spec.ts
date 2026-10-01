import { describe, expect, it } from 'vitest';
import { renderMarkdown, slugify } from './markdown';

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

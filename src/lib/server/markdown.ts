// Markdown → HTML for post bodies: `marked` plus Shiki, with h2/h3 ids for the table of contents.
// Shiki uses the fine-grained core, the JavaScript regex engine (no WASM on Workers) and only the
// languages below, to keep the Worker bundle small (docs/infrastructure.md → Free plan limits).

import { Marked, Renderer, type Tokens } from 'marked';
import { createHighlighterCoreSync } from 'shiki/core';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';
import bash from 'shiki/langs/bash.mjs';
import c from 'shiki/langs/c.mjs';
import cpp from 'shiki/langs/cpp.mjs';
import csharp from 'shiki/langs/csharp.mjs';
import dockerfile from 'shiki/langs/dockerfile.mjs';
import go from 'shiki/langs/go.mjs';
import javascript from 'shiki/langs/javascript.mjs';
import json from 'shiki/langs/json.mjs';
import python from 'shiki/langs/python.mjs';
import sql from 'shiki/langs/sql.mjs';
import svelte from 'shiki/langs/svelte.mjs';
import tsx from 'shiki/langs/tsx.mjs';
import typescript from 'shiki/langs/typescript.mjs';
import yaml from 'shiki/langs/yaml.mjs';
import githubDark from 'shiki/themes/github-dark.mjs';
import githubLight from 'shiki/themes/github-light.mjs';
import { responsive } from '$lib/images';
import type { Heading } from '$lib/types/content';

const highlighter = createHighlighterCoreSync({
	themes: [githubLight, githubDark],
	langs: [
		bash,
		c,
		cpp,
		csharp,
		dockerfile,
		go,
		javascript,
		json,
		python,
		sql,
		svelte,
		tsx,
		typescript,
		yaml
	],
	engine: createJavaScriptRegexEngine()
});

/** Names shown in the code block header; the fence's language otherwise. */
const LANGUAGE_NAMES: Record<string, string> = {
	bash: 'Bash',
	sh: 'Shell',
	shell: 'Shell',
	c: 'C',
	cpp: 'C++',
	csharp: 'C#',
	cs: 'C#',
	dockerfile: 'Dockerfile',
	go: 'Go',
	js: 'JavaScript',
	javascript: 'JavaScript',
	json: 'JSON',
	py: 'Python',
	python: 'Python',
	sql: 'SQL',
	svelte: 'Svelte',
	ts: 'TypeScript',
	typescript: 'TypeScript',
	tsx: 'TSX',
	yaml: 'YAML',
	yml: 'YAML'
};

const escapeHtml = (s: string) =>
	s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function slugify(text: string): string {
	return (
		text
			.toLowerCase()
			.normalize('NFKD')
			.replace(/[̀-ͯ]/g, '')
			.replace(/&[a-z]+;/g, '')
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '') || 'section'
	);
}

function highlight(code: string, lang: string): string {
	const loaded = highlighter.getLoadedLanguages();
	return highlighter.codeToHtml(code, {
		lang: loaded.includes(lang) ? lang : 'text',
		themes: { light: 'github-light', dark: 'github-dark' }
	});
}

/**
 * A fenced block's info string is `lang` or `lang filename`, e.g. ```ts rotation.ts
 * The header shows the filename (if any) and the language; the Copy button is wired up in
 * Prose.svelte and hidden without JavaScript.
 */
function codeBlock({ text, lang }: Tokens.Code): string {
	const [language = '', ...rest] = (lang ?? '').trim().split(/\s+/);
	const filename = rest.join(' ');
	const label = LANGUAGE_NAMES[language] ?? language;
	const meta = [filename, label].filter(Boolean).map(escapeHtml);
	return `<div class="code-block not-prose -mx-5 my-6 border-y border-neutral-200 bg-neutral-50 font-mono text-sm md:mx-0 dark:border-neutral-800 dark:bg-neutral-900">
<div class="flex min-h-11 items-center justify-between border-b border-neutral-200 px-4 text-sm text-neutral-600 dark:border-neutral-800 dark:text-neutral-400">
<span class="flex items-center gap-2.5">${meta.join('<span aria-hidden="true">·</span>')}</span>
<button type="button" data-copy class="-mr-2 hidden min-h-11 min-w-11 items-center justify-center gap-1.5 px-3 font-sans text-sm js:inline-flex" aria-label="Copy code to clipboard"><span data-copy-label aria-live="polite">Copy</span></button>
</div>
${highlight(text, language)}
</div>`;
}

export function renderMarkdown(markdown: string): { html: string; headings: Heading[] } {
	const headings: Heading[] = [];
	const used = new Map<string, number>();

	const marked = new Marked({
		gfm: true,
		renderer: {
			heading({ tokens, depth, text }) {
				const html = this.parser.parseInline(tokens);
				if (depth !== 2 && depth !== 3) return `<h${depth}>${html}</h${depth}>\n`;
				const base = slugify(text);
				const count = used.get(base) ?? 0;
				used.set(base, count + 1);
				const id = count ? `${base}-${count + 1}` : base;
				// Plain text for the ToC: the inline HTML without its tags.
				headings.push({ id, text: html.replace(/<[^>]+>/g, ''), level: depth });
				// tabindex lets the ToC move focus to the heading after scrolling to it.
				return `<h${depth} id="${id}" tabindex="-1">${html}</h${depth}>\n`;
			},
			code: codeBlock,
			table(token) {
				// Wide tables scroll on their own instead of widening the page.
				const table = Renderer.prototype.table.call(this, token);
				return `<div class="overflow-x-auto">${table}</div>`;
			},
			image({ href, title, text }) {
				const t = title ? ` title="${escapeHtml(title)}"` : '';
				// Unsplash/Pexels links get responsive sizes from the CDN (#40).
				const { src, srcset } = responsive(href);
				const set = srcset
					? ` srcset="${escapeHtml(srcset)}" sizes="(min-width: 768px) 680px, 100vw"`
					: '';
				return `<img src="${escapeHtml(src)}"${set} alt="${escapeHtml(text)}"${t} loading="lazy" decoding="async">`;
			},
			paragraph(token) {
				// An image with an italic line directly under it is a captioned figure (#40):
				//   ![Alt](https://images.unsplash.com/…)
				//   *Photo by [Name](…) on [Unsplash](…)*
				const parts = token.tokens.filter(
					(t) => !(t.type === 'text' && !t.raw.trim()) && t.type !== 'br'
				);
				if (parts.length === 2 && parts[0].type === 'image' && parts[1].type === 'em') {
					const img = this.parser.parseInline([parts[0]]);
					const caption = this.parser.parseInline((parts[1] as Tokens.Em).tokens);
					return `<figure>${img}<figcaption>${caption}</figcaption></figure>\n`;
				}
				return Renderer.prototype.paragraph.call(this, token);
			}
		}
	});

	const html = marked.parse(markdown, { async: false });
	return { html, headings };
}

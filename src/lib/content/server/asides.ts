// Aside queries (#18). The stream is small, so /asides loads every published aside once and
// filters and pages in the browser; each body is rendered to HTML here.

import { kindLabel } from '../asides';
import { formatDate } from '../format';
import type { Aside, RenderedAside } from '../types';
import { firstParagraph, renderMarkdown } from './markdown';
import { mergeDrafts } from '$lib/publishing/index.server';
import { strapi } from './strapi';

const QUERY = {
	fields: [
		'kind',
		'title',
		'slug',
		'body',
		'sourceAuthor',
		'sourceTitle',
		'sourceUrl',
		'publishedAt',
		'updatedAt'
	],
	populate: { tags: { fields: ['name', 'slug'] } },
	sort: ['publishedAt:desc']
};

/**
 * A plain-text name for an aside without a title, for page titles, link text and screen readers:
 * "Quote from An Elegant Puzzle", or the first words of the body.
 */
export function asideLabel(
	aside: Pick<Aside, 'kind' | 'title' | 'body' | 'sourceTitle' | 'publishedAt'>
) {
	if (aside.title) return aside.title;
	if (aside.kind === 'quote' && aside.sourceTitle) return `Quote from ${aside.sourceTitle}`;
	if (aside.kind === 'code')
		return `${kindLabel(aside.kind)} from ${formatDate(aside.publishedAt)}`;
	return (
		firstParagraph(aside.body, 60) ||
		`${kindLabel(aside.kind)} from ${formatDate(aside.publishedAt)}`
	);
}

function render({ body, ...aside }: Aside): RenderedAside {
	return {
		...aside,
		tags: aside.tags ?? [],
		html: renderMarkdown(body ?? '').html,
		label: asideLabel({ ...aside, body: body ?? '' })
	};
}

/** `drafts`: in preview (#57), also unpublished asides and unpublished edits, newest edit first. */
async function fetchAll(locals: App.Locals, drafts = false): Promise<Aside[]> {
	const client = strapi(locals);
	const published = await client.findAll<Aside>('aside', QUERY);
	if (!drafts) return published;
	const latest = await client.findAll<Aside>('aside', { ...QUERY, status: 'draft' });
	return mergeDrafts(published, latest).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

export async function listAsides(
	locals: App.Locals,
	{ drafts = false }: { drafts?: boolean } = {}
): Promise<RenderedAside[]> {
	return (await fetchAll(locals, drafts)).map(render);
}

/** One aside plus its neighbours in the stream (newer, older) for the page's links. */
export async function getAside(
	locals: App.Locals,
	slug: string,
	{ drafts = false }: { drafts?: boolean } = {}
) {
	const all = await fetchAll(locals, drafts);
	const i = all.findIndex((a) => a.slug === slug);
	if (i === -1) return undefined;
	const link = (a: Aside | undefined) => a && { slug: a.slug, label: asideLabel(a) };
	const a = all[i];
	const text = firstParagraph(a.body ?? '');
	const description =
		a.kind === 'quote' && (a.sourceAuthor || a.sourceTitle)
			? `“${text}” — ${[a.sourceAuthor, a.sourceTitle].filter(Boolean).join(', ')}`
			: text;
	return {
		aside: render(a),
		description,
		/** The body's first paragraph as plain text, for the share card (#62). */
		text,
		newer: link(all[i - 1]),
		older: link(all[i + 1])
	};
}

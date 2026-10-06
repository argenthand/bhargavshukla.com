import { beforeEach, describe, expect, it, vi } from 'vitest';

// Sections hidden from the nav, for the live-section cases; every section is live otherwise.
const hidden = vi.hoisted(() => new Set<string>());
vi.mock('$lib/site/site', () => ({ isLive: (href: string) => !hidden.has(href) }));

const { dataUrl, entryAt, planPublish, readTags } = await import('./content-map');

beforeEach(() => hidden.clear());

describe('readTags', () => {
	it('tags the content type itself', () => {
		expect(readTags('post')).toEqual(['type:post']);
	});

	it('adds populated relations, by the names the content type gives them', () => {
		expect(readTags('post', { populate: { category: {}, related: {}, cover: {} } })).toEqual([
			'type:post',
			'type:category'
		]);
		expect(readTags('post', { populate: 'category' })).toEqual(['type:post', 'type:category']);
		expect(readTags('aside', { populate: { tags: {} } })).toEqual(['type:aside', 'type:tag']);
		expect(readTags('tag', { populate: ['asides'] })).toEqual(['type:tag', 'type:aside']);
	});

	it("ignores a key that isn't one of this content type's relations", () => {
		expect(readTags('aside', { populate: { category: {} } })).toEqual(['type:aside']);
	});
});

describe('entryAt', () => {
	it('finds posts and asides by their pages', () => {
		expect(entryAt('/blog/first-post')).toEqual({ type: 'post', slug: 'first-post' });
		expect(entryAt('/asides/a-tip')).toEqual({ type: 'aside', slug: 'a-tip' });
	});

	it('rejects everything else', () => {
		for (const path of [
			'/',
			'/blog',
			'/blog/',
			'/blog/a/b',
			'/resume',
			'/blog/a b',
			'//blog/a',
			'/tags/x'
		])
			expect(entryAt(path)).toBeUndefined();
	});
});

describe('planPublish', () => {
	const page = (path: string) => [path, dataUrl(path)];
	const purge = (type: string, urls: string[]) => ({
		action: 'purge',
		tags: [`type:${type}`],
		urls
	});
	const webhook = (event: string, type: string, slug?: string) => ({
		event,
		uid: `api::${type}.${type}`,
		...(slug && { entry: { slug } })
	});

	it.each(['entry.publish', 'entry.unpublish', 'entry.delete'])(
		'%s is a publish for every content type',
		(event) => {
			for (const type of ['post', 'aside', 'resume', 'tag', 'category', 'profile'])
				expect(planPublish(webhook(event, type)).action).toBe('purge');
		}
	);

	it.each(['entry.create', 'entry.update'])('%s is a publish without drafts only', (event) => {
		for (const type of ['tag', 'category', 'profile'])
			expect(planPublish(webhook(event, type)).action).toBe('purge');
		for (const type of ['post', 'aside', 'resume'])
			expect(planPublish(webhook(event, type)).action).toBe('ignore');
	});

	it('fetches again only the key pages that show the content type, then the feeds', () => {
		expect(planPublish(webhook('entry.publish', 'post', 'hello-world'))).toEqual(
			purge('post', [
				...page('/'),
				...page('/blog'),
				...page('/blog/hello-world'),
				'/rss.xml',
				'/sitemap.xml'
			])
		);
		expect(planPublish(webhook('entry.update', 'tag', 'svelte'))).toEqual(
			purge('tag', page('/asides'))
		);
		expect(planPublish(webhook('entry.update', 'profile'))).toEqual(
			purge('profile', [...page('/'), ...page('/resume')])
		);
		expect(planPublish(webhook('entry.publish', 'resume'))).toEqual(
			purge('resume', [...page('/resume'), '/sitemap.xml'])
		);
	});

	it('purges everything on { all: true }, and fetches every key page again', () => {
		expect(planPublish({ all: true })).toEqual({
			action: 'purge',
			urls: [
				...page('/'),
				...page('/blog'),
				...page('/asides'),
				...page('/resume'),
				'/rss.xml',
				'/sitemap.xml'
			]
		});
	});

	it("leaves out pages of sections that aren't live", () => {
		hidden.add('/asides');
		expect(planPublish(webhook('entry.publish', 'aside', 'a-tip'))).toEqual(
			purge('aside', ['/sitemap.xml'])
		);
		expect(planPublish({ all: true })).not.toMatchObject({
			urls: expect.arrayContaining(['/asides'])
		});
	});

	it("ignores slugs Strapi couldn't have made", () => {
		const plan = planPublish(webhook('entry.publish', 'post', '../admin'));
		expect(plan).toEqual(
			purge('post', [...page('/'), ...page('/blog'), '/rss.xml', '/sitemap.xml'])
		);
	});

	it('ignores media, content types the site never shows, and anything else', () => {
		expect(planPublish({ event: 'media.create', uid: 'plugin::upload.file' }).action).toBe(
			'ignore'
		);
		expect(
			planPublish({ event: 'entry.publish', uid: 'plugin::users-permissions.user' }).action
		).toBe('ignore');
		expect(planPublish({ event: 'entry.publish', uid: 'api::widget.widget' }).action).toBe(
			'ignore'
		);
		expect(planPublish(null).action).toBe('ignore');
		expect(planPublish({ all: 'yes' }).action).toBe('ignore');
		expect(planPublish({ uid: 'api::post.post' }).action).toBe('ignore');
	});

	it('spells page data exactly as the SvelteKit client asks for it', () => {
		expect(dataUrl('/')).toBe(
			'/__data.json?x-sveltekit-trailing-slash=1&x-sveltekit-invalidated=01'
		);
		expect(dataUrl('/blog')).toBe('/blog/__data.json?x-sveltekit-invalidated=01');
	});
});

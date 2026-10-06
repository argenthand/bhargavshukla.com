import { describe, expect, it, vi } from 'vitest';
import type { Post, PostSummary } from '../types';

vi.mock('$env/dynamic/private', () => ({ env: {} }));

const { byShownDate, pickNextUp } = await import('./posts');

const cat = (slug: string) => ({ documentId: slug, name: slug, slug });
const summary = (slug: string, category: string, publishedAt: string): PostSummary => ({
	documentId: slug,
	title: slug,
	slug,
	summary: '',
	featured: false,
	displayDate: null,
	publishedAt,
	updatedAt: publishedAt,
	category: cat(category)
});
const post = (base: PostSummary, related: PostSummary[] = []): Post => ({
	...base,
	body: '',
	cover: null,
	related,
	seo: null
});

const all = [
	summary('d', 'ideas', '2026-09-04T00:00:00Z'),
	summary('c', 'leadership', '2026-09-03T00:00:00Z'),
	summary('b', 'ideas', '2026-09-02T00:00:00Z'),
	summary('a', 'leadership', '2026-09-01T00:00:00Z')
];

describe('pickNextUp', () => {
	it('uses the related picks when set', () => {
		const current = post(all[0], [all[3]]);
		expect(pickNextUp(current, all).map((p) => p.slug)).toEqual(['a']);
	});

	it('prefers the same category, then newest overall, never the post itself', () => {
		expect(pickNextUp(post(all[3]), all).map((p) => p.slug)).toEqual(['c', 'd']);
	});

	it('returns nothing when there are no other posts', () => {
		expect(pickNextUp(post(all[0]), [all[0]])).toEqual([]);
	});
});

describe('byShownDate', () => {
	it('sorts by displayDate over publishedAt, newest first', () => {
		const backdated = {
			...summary('old', 'ideas', '2026-09-10T00:00:00Z'),
			displayDate: '2020-01-01'
		};
		expect([backdated, all[3]].sort(byShownDate).map((p) => p.slug)).toEqual(['a', 'old']);
	});
});

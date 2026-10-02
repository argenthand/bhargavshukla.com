import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
	COOKIE_TTL_S,
	isSitePath,
	mergeDrafts,
	previewCookie,
	signLink,
	verifyCookie,
	verifyLink
} from './preview';
import { LINK_TTL_S, previewLink } from '../../../scripts/preview-link.mjs';

const SECRET = 'test-secret';
const NOW = 1_800_000_000;

describe('verifyLink', () => {
	it('accepts a fresh link signed with the secret', async () => {
		expect(await verifyLink(await signLink('/blog/draft', SECRET, NOW + 300), SECRET, NOW)).toBe(
			true
		);
	});

	it('matches what the CMS mints with Node crypto (cms/config/admin.ts)', async () => {
		const exp = NOW + 300;
		const sig = createHmac('sha256', SECRET).update(`link\n/blog/draft\n${exp}`).digest('hex');
		expect(await verifyLink({ path: '/blog/draft', exp: String(exp), sig }, SECRET, NOW)).toBe(
			true
		);
	});

	it('rejects a changed path, an expired or far-future link, another secret, or no secret', async () => {
		const link = await signLink('/blog/draft', SECRET, NOW + 300);
		expect(await verifyLink({ ...link, path: '/blog/other' }, SECRET, NOW)).toBe(false);
		expect(await verifyLink(link, SECRET, NOW + 301)).toBe(false);
		expect(await verifyLink(await signLink('/blog/draft', SECRET, NOW + 86_400), SECRET, NOW)).toBe(
			false
		);
		expect(await verifyLink(link, 'other-secret', NOW)).toBe(false);
		expect(await verifyLink(link, undefined, NOW)).toBe(false);
		expect(await verifyLink(link, '', NOW)).toBe(false);
	});

	it('never redirects off the site, even with a valid signature', async () => {
		for (const path of ['//evil.example', '/\\evil.example', 'https://evil.example', 'blog']) {
			expect(await verifyLink(await signLink(path, SECRET, NOW + 300), SECRET, NOW)).toBe(false);
		}
	});

	it('rejects garbage signatures and missing fields', async () => {
		expect(
			await verifyLink({ path: '/blog/x', exp: String(NOW + 300), sig: 'zz' }, SECRET, NOW)
		).toBe(false);
		expect(await verifyLink({ path: '/blog/x', exp: null, sig: null }, SECRET, NOW)).toBe(false);
	});
});

describe('preview cookie', () => {
	it('verifies until it expires', async () => {
		const value = await previewCookie(SECRET, NOW);
		expect(await verifyCookie(value, SECRET, NOW + 60)).toBe(true);
		expect(await verifyCookie(value, SECRET, NOW + COOKIE_TTL_S)).toBe(false);
	});

	it('ignores a hand-made, tampered or foreign cookie', async () => {
		const value = await previewCookie(SECRET, NOW);
		const [exp, sig] = value.split('.');
		expect(await verifyCookie('1', SECRET, NOW)).toBe(false);
		expect(await verifyCookie('true', SECRET, NOW)).toBe(false);
		expect(await verifyCookie(`${Number(exp) + 60}.${sig}`, SECRET, NOW)).toBe(false);
		expect(await verifyCookie(value, 'other-secret', NOW)).toBe(false);
		expect(await verifyCookie(value, undefined, NOW)).toBe(false);
		expect(await verifyCookie(undefined, SECRET, NOW)).toBe(false);
	});

	it('is not interchangeable with a link signature', async () => {
		const link = await signLink('/', SECRET, NOW + 300);
		expect(await verifyCookie(`${link.exp}.${link.sig}`, SECRET, NOW)).toBe(false);
	});
});

describe('isSitePath', () => {
	it('allows only same-site absolute paths', () => {
		expect(isSitePath('/')).toBe(true);
		expect(isSitePath('/blog/x?y=1')).toBe(true);
		expect(isSitePath('//x')).toBe(false);
		expect(isSitePath('/\\x')).toBe(false);
		expect(isSitePath('x')).toBe(false);
	});
});

describe('mergeDrafts', () => {
	it('keeps publish dates for live documents and marks the rest as drafts', () => {
		const published = [{ documentId: 'a', publishedAt: '2026-09-01T00:00:00Z', title: 'A (live)' }];
		const drafts = [
			{
				documentId: 'a',
				publishedAt: null,
				updatedAt: '2026-09-20T00:00:00Z',
				title: 'A (edited)'
			},
			{ documentId: 'b', publishedAt: null, updatedAt: '2026-09-25T00:00:00Z', title: 'B' }
		];
		expect(mergeDrafts(published, drafts)).toEqual([
			{
				documentId: 'a',
				publishedAt: '2026-09-01T00:00:00Z',
				updatedAt: '2026-09-20T00:00:00Z',
				title: 'A (edited)',
				draft: false
			},
			{
				documentId: 'b',
				publishedAt: '2026-09-25T00:00:00Z',
				updatedAt: '2026-09-25T00:00:00Z',
				title: 'B',
				draft: true
			}
		]);
	});
});

describe('scripts/preview-link.mjs (#98)', () => {
	it('mints links the site accepts, and only for the secret it was given', async () => {
		const url = new URL(previewLink('http://localhost:5173', '/resume', SECRET, NOW + LINK_TTL_S));
		const link = {
			path: url.searchParams.get('path'),
			exp: url.searchParams.get('exp'),
			sig: url.searchParams.get('sig')
		};
		expect(url.pathname).toBe('/api/preview');
		expect(await verifyLink(link, SECRET, NOW)).toBe(true);
		expect(await verifyLink(link, 'production-secret', NOW)).toBe(false);
	});
});

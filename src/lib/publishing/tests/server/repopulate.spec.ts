import { describe, expect, it, vi } from 'vitest';
import { repopulate } from '../../server/repopulate';

describe('repopulate', () => {
	it('fetches every URL, a few at a time, and reports failures', async () => {
		vi.spyOn(console, 'log').mockImplementation(() => {});
		let inFlight = 0;
		let most = 0;
		const fetchPage = async (path: string) => {
			most = Math.max(most, ++inFlight);
			await new Promise((r) => setTimeout(r, 1));
			inFlight--;
			return new Response('x', { status: path === '/broken' ? 500 : 200 });
		};
		const urls = ['/', '/blog', '/asides', '/resume', '/broken', '/rss.xml'];

		const result = await repopulate(urls, fetchPage, 2);

		expect(result).toEqual({ ok: 5, failed: ['/broken'] });
		expect(most).toBe(2);
	});

	it('counts a thrown fetch as a failure and carries on', async () => {
		vi.spyOn(console, 'log').mockImplementation(() => {});
		const fetchPage = async (path: string) => {
			if (path === '/blog') throw new Error('offline');
			return new Response('x');
		};
		expect(await repopulate(['/', '/blog'], fetchPage)).toEqual({ ok: 1, failed: ['/blog'] });
	});
});

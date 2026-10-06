// Read counts (#87): GET answers with counts and fails quietly, POST counts a read only from the
// site's own pages and always answers 204.

import { afterEach, describe, expect, it, vi } from 'vitest';

const { dev, readCounts, recordRead, find } = vi.hoisted(() => ({
	dev: { value: false },
	readCounts: vi.fn(),
	recordRead: vi.fn(),
	find: vi.fn()
}));

vi.mock('$app/environment', () => ({
	get dev() {
		return dev.value;
	}
}));
vi.mock('$lib/analytics/index.server', () => ({ readCounts, recordRead }));
vi.mock('$lib/content/index.server', () => ({ strapi: () => ({ find }) }));

const { GET, POST } = await import('../../api/views/+server');
const { site } = await import('$lib/site');

const DB = {};
const origin = new URL(site.url).origin;

afterEach(() => {
	dev.value = false;
	readCounts.mockReset();
	recordRead.mockReset();
	find.mockReset();
	vi.restoreAllMocks();
});

function get(search: string, platform: unknown = { env: { READS: DB } }) {
	return GET({ url: new URL(`${origin}/api/views${search}`), platform } as never);
}

function post(
	body: string,
	{
		headers = { origin },
		url = `${origin}/api/views`,
		preview = false,
		platform = { env: { READS: DB } }
	}: { headers?: Record<string, string>; url?: string; preview?: boolean; platform?: unknown } = {}
) {
	return POST({
		request: new Request(url, { method: 'POST', headers, body }),
		url: new URL(url),
		locals: { preview },
		platform,
		getClientAddress: () => '203.0.113.7'
	} as never);
}

describe('GET', () => {
	it('returns the counts for the paths asked about, kept for a minute', async () => {
		readCounts.mockResolvedValue({ '/blog/a': 1200 });
		const response = await get('?path=/blog/a&path=/blog/b');
		expect(readCounts).toHaveBeenCalledWith(DB, ['/blog/a', '/blog/b']);
		expect(await response.json()).toEqual({ '/blog/a': 1200 });
		expect(response.headers.get('cache-control')).toBe('public, max-age=60');
	});

	it('answers with no counts when there is no database', async () => {
		const response = await get('?path=/blog/a', null);
		expect(readCounts).not.toHaveBeenCalled();
		expect(await response.json()).toEqual({});
	});

	it('answers {} and is not kept when the database fails', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		readCounts.mockRejectedValue(new Error('D1 down'));
		const response = await get('?path=/blog/a');
		expect(await response.json()).toEqual({});
		expect(response.headers.get('cache-control')).toBe('no-store');
	});
});

describe('POST', () => {
	it('records a read from the site, with the visitor and the path as sent', async () => {
		recordRead.mockResolvedValue(undefined);
		const response = await post('/blog/a', { headers: { origin, 'user-agent': 'Browser/1' } });
		expect(response.status).toBe(204);
		expect(recordRead).toHaveBeenCalledWith(
			DB,
			{ path: '/blog/a', ip: '203.0.113.7', userAgent: 'Browser/1' },
			expect.any(Function)
		);
	});

	it('cuts the path at 300 characters', async () => {
		await post('/' + 'a'.repeat(500));
		expect(recordRead.mock.calls[0][1].path).toHaveLength(300);
	});

	it('checks that the entry is published, asking for one slug', async () => {
		find.mockResolvedValue({ data: [{ slug: 'a' }] });
		await post('/blog/a');
		const exists = recordRead.mock.calls[0][2];
		expect(await exists({ type: 'post', slug: 'a' })).toBe(true);
		expect(find).toHaveBeenCalledWith(
			'post',
			expect.objectContaining({ pagination: { pageSize: 1 } })
		);
		find.mockResolvedValue({ data: [] });
		expect(await exists({ type: 'post', slug: 'gone' })).toBe(false);
	});

	it.each([
		['another origin', { headers: { origin: 'https://evil.example' } }],
		['no origin', { headers: {} }],
		['preview mode', { preview: true }],
		['no database', { platform: { env: {} } }],
		[
			'a preview deploy',
			{
				url: 'https://preview.workers.dev/api/views',
				headers: { origin: 'https://preview.workers.dev' }
			}
		]
	])('answers 204 and counts nothing from %s', async (_, options) => {
		const response = await post('/blog/a', options);
		expect(response.status).toBe(204);
		expect(recordRead).not.toHaveBeenCalled();
	});

	it('counts under `vite dev`, whatever the host', async () => {
		dev.value = true;
		const url = 'http://localhost:5173/api/views';
		await post('/blog/a', { url, headers: { origin: 'http://localhost:5173' } });
		expect(recordRead).toHaveBeenCalledOnce();
	});

	it('still answers 204 when recording fails', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		recordRead.mockRejectedValue(new Error('D1 down'));
		expect((await post('/blog/a')).status).toBe(204);
	});
});

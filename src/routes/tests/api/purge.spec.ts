// The Strapi webhook's route: the purge and repopulate logic are tested in
// publishing/tests/server/purge.spec.ts; here is only how the route wires the Worker into them.

import { afterEach, describe, expect, it, vi } from 'vitest';

const { handlePurge, repopulate } = vi.hoisted(() => ({
	handlePurge: vi.fn(),
	repopulate: vi.fn()
}));

vi.mock('$env/dynamic/private', () => ({ env: { PURGE_SECRET: 'webhook-secret' } }));
vi.mock('$lib/publishing/index.server', () => ({ handlePurge, repopulate }));

const { POST } = await import('../../api/purge/+server');

afterEach(() => {
	handlePurge.mockReset();
	repopulate.mockReset();
});

const request = new Request('https://site.test/api/purge', { method: 'POST' });
const url = new URL('https://site.test/api/purge');

describe('POST /api/purge', () => {
	it('gives handlePurge the secret, and no purge or repopulate outside a Worker', async () => {
		handlePurge.mockResolvedValue(new Response('ok'));
		const response = await POST({ request, url, platform: undefined } as never);
		expect(handlePurge).toHaveBeenCalledWith(request, 'webhook-secret', undefined, undefined);
		expect(await response.text()).toBe('ok');
	});

	it('purges through the Worker cache and repopulates through the Worker itself', async () => {
		handlePurge.mockResolvedValue(new Response('ok'));
		const purge = vi.fn().mockResolvedValue({ success: true });
		const fetch = vi.fn().mockResolvedValue(new Response('page'));
		const waitUntil = vi.fn();
		const ctx = { cache: { purge }, exports: { default: { fetch } }, waitUntil };
		repopulate.mockImplementation(async (urls, get) => {
			for (const path of urls) await get(path);
		});

		await POST({ request, url, platform: { ctx } } as never);
		const [, , purgeCache, repopulateUrls] = handlePurge.mock.calls[0];

		await purgeCache({ tags: ['type:post'] });
		expect(purge).toHaveBeenCalledWith({ tags: ['type:post'] });

		repopulateUrls(['/', '/blog']);
		expect(waitUntil).toHaveBeenCalledOnce();
		await waitUntil.mock.calls[0][0];
		expect(fetch.mock.calls.map(([req]) => new URL(req.url).href)).toEqual([
			'https://site.test/',
			'https://site.test/blog'
		]);
	});

	it('purges but cannot repopulate when the Worker has no entrypoint to call', async () => {
		handlePurge.mockResolvedValue(new Response('ok'));
		await POST({ request, url, platform: { ctx: { cache: { purge: vi.fn() } } } } as never);
		const [, , purgeCache, repopulateUrls] = handlePurge.mock.calls[0];
		expect(purgeCache).toBeTypeOf('function');
		expect(repopulateUrls).toBeUndefined();
	});
});

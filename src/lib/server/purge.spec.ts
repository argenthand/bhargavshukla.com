import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('$env/dynamic/private', () => ({ env: {} }));

const { bearerMatches, handlePurge } = await import('./purge');

const SECRET = 'webhook-secret';

function webhook(body: unknown, auth: string | null = `Bearer ${SECRET}`) {
	return new Request('https://site.test/api/purge', {
		method: 'POST',
		headers: auth ? { authorization: auth } : {},
		body: JSON.stringify(body)
	});
}

/** A fake `ctx.cache.purge` that records what it was asked to purge. */
function workersCache(
	result: { success: boolean; errors?: unknown[] } | Error = { success: true }
) {
	const calls: unknown[] = [];
	const purge = async (options: unknown) => {
		calls.push(options);
		if (result instanceof Error) throw result;
		return result;
	};
	return { calls, purge };
}

afterEach(() => vi.restoreAllMocks());

describe('bearerMatches', () => {
	it('accepts the exact secret only', async () => {
		expect(await bearerMatches(`Bearer ${SECRET}`, SECRET)).toBe(true);
		expect(await bearerMatches(`Bearer ${SECRET}x`, SECRET)).toBe(false);
		expect(await bearerMatches(SECRET, SECRET)).toBe(false);
		expect(await bearerMatches(null, SECRET)).toBe(false);
		expect(await bearerMatches('Bearer ', '')).toBe(false);
	});
});

describe('handlePurge', () => {
	it('rejects a missing or wrong token without purging', async () => {
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		const { calls, purge } = workersCache();
		const body = { event: 'entry.publish', uid: 'api::post.post' };

		expect((await handlePurge(webhook(body, null), SECRET, purge)).status).toBe(401);
		expect((await handlePurge(webhook(body, 'Bearer nope'), SECRET, purge)).status).toBe(401);
		expect((await handlePurge(webhook(body), undefined, purge)).status).toBe(401);
		expect(calls).toHaveLength(0);
	});

	it('purges the tags, then repopulates the URLs the content map gives', async () => {
		vi.spyOn(console, 'log').mockImplementation(() => {});
		const { calls, purge } = workersCache();
		const repopulate = vi.fn();
		const body = { event: 'entry.publish', uid: 'api::post.post', entry: { slug: 'a' } };

		const res = await handlePurge(webhook(body), SECRET, purge, repopulate);

		expect(res.status).toBe(200);
		expect(calls).toEqual([{ tags: ['type:post'] }]);
		expect(repopulate).toHaveBeenCalledWith(expect.arrayContaining(['/blog', '/blog/a']));
	});

	it('purges everything on { all: true }', async () => {
		vi.spyOn(console, 'log').mockImplementation(() => {});
		const { calls, purge } = workersCache();

		expect((await handlePurge(webhook({ all: true }), SECRET, purge)).status).toBe(200);
		expect(calls).toEqual([{ purgeEverything: true }]);
	});

	it('answers 200 without a purge when there is nothing to do', async () => {
		vi.spyOn(console, 'log').mockImplementation(() => {});
		const { calls, purge } = workersCache();
		const repopulate = vi.fn();

		const res = await handlePurge(
			webhook({ event: 'entry.update', uid: 'api::post.post' }),
			SECRET,
			purge,
			repopulate
		);
		expect(res.status).toBe(200);
		expect(calls).toHaveLength(0);
		expect(repopulate).not.toHaveBeenCalled();
	});

	it('answers 502, without repopulating, when the purge fails or throws', async () => {
		const error = vi.spyOn(console, 'error').mockImplementation(() => {});
		const body = { event: 'entry.delete', uid: 'api::aside.aside' };
		const repopulate = vi.fn();

		const refused = workersCache({ success: false, errors: ['rate limited'] });
		expect((await handlePurge(webhook(body), SECRET, refused.purge, repopulate)).status).toBe(502);
		const thrown = workersCache(new Error('boom'));
		expect((await handlePurge(webhook(body), SECRET, thrown.purge, repopulate)).status).toBe(502);
		expect(repopulate).not.toHaveBeenCalled();
		expect(error).toHaveBeenCalledTimes(2);
	});

	it('answers 500 when Workers Cache is missing', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const res = await handlePurge(
			webhook({ event: 'entry.publish', uid: 'api::post.post' }),
			SECRET,
			undefined
		);
		expect(res.status).toBe(500);
	});
});

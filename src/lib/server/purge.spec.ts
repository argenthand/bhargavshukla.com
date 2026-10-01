import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('$env/dynamic/private', () => ({ env: {} }));

const { bearerMatches, handlePurge, modelFromUid, planPurge } = await import('./purge');

const SECRET = 'webhook-secret';
const config = { secret: SECRET, zoneId: 'zone123', token: 'cf-token' };

function webhook(body: unknown, auth: string | null = `Bearer ${SECRET}`) {
	return new Request('https://site.test/api/purge', {
		method: 'POST',
		headers: auth ? { authorization: auth } : {},
		body: JSON.stringify(body)
	});
}

/** A fake Cloudflare API that records the purge requests it gets. */
function cloudflare(status = 200) {
	const calls: { url: string; init: RequestInit }[] = [];
	const fetcher = (async (url: string, init: RequestInit) => {
		calls.push({ url, init });
		return new Response(JSON.stringify({ success: status === 200 }), { status });
	}) as unknown as typeof fetch;
	return { calls, fetcher };
}

afterEach(() => vi.restoreAllMocks());

describe('modelFromUid', () => {
	it('reads the model from api uids the site knows', () => {
		expect(modelFromUid('api::post.post')).toBe('post');
		expect(modelFromUid('api::profile.profile')).toBe('profile');
	});

	it('ignores plugin and unknown uids', () => {
		expect(modelFromUid('plugin::upload.file')).toBeUndefined();
		expect(modelFromUid('api::widget.widget')).toBeUndefined();
		expect(modelFromUid(undefined)).toBeUndefined();
	});
});

describe('planPurge', () => {
	const purge = (model: string) => ({ action: 'tags', tags: [`type:${model}`] });

	it.each(['entry.publish', 'entry.unpublish', 'entry.delete'])(
		'%s purges the model, with or without Draft & Publish',
		(event) => {
			expect(planPurge({ event, uid: 'api::post.post' })).toEqual(purge('post'));
			expect(planPurge({ event, uid: 'api::aside.aside' })).toEqual(purge('aside'));
			expect(planPurge({ event, uid: 'api::tag.tag' })).toEqual(purge('tag'));
		}
	);

	it.each(['entry.create', 'entry.update'])('%s purges models without drafts', (event) => {
		for (const model of ['tag', 'category', 'profile']) {
			expect(planPurge({ event, uid: `api::${model}.${model}` })).toEqual(purge(model));
		}
	});

	it.each(['entry.create', 'entry.update'])('%s is a draft save for the others', (event) => {
		for (const model of ['post', 'aside', 'resume']) {
			expect(planPurge({ event, uid: `api::${model}.${model}` }).action).toBe('ignore');
		}
	});

	it('ignores media events and models the site never reads', () => {
		expect(planPurge({ event: 'media.create', uid: 'plugin::upload.file' }).action).toBe('ignore');
		expect(planPurge({ event: 'media.delete' }).action).toBe('ignore');
		expect(
			planPurge({ event: 'entry.publish', uid: 'plugin::users-permissions.user' }).action
		).toBe('ignore');
	});

	it('purges everything on { all: true }', () => {
		expect(planPurge({ all: true })).toEqual({ action: 'everything' });
	});

	it('ignores anything else', () => {
		expect(planPurge(null).action).toBe('ignore');
		expect(planPurge({ all: 'yes' }).action).toBe('ignore');
		expect(planPurge({ uid: 'api::post.post' }).action).toBe('ignore');
	});
});

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
	it('rejects a missing or wrong token without calling Cloudflare', async () => {
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		const { calls, fetcher } = cloudflare();
		const body = { event: 'entry.publish', uid: 'api::post.post' };

		expect((await handlePurge(webhook(body, null), config, fetcher)).status).toBe(401);
		expect((await handlePurge(webhook(body, 'Bearer nope'), config, fetcher)).status).toBe(401);
		expect(
			(await handlePurge(webhook(body), { ...config, secret: undefined }, fetcher)).status
		).toBe(401);
		expect(calls).toHaveLength(0);
	});

	it('purges the tags with the zone and token', async () => {
		vi.spyOn(console, 'log').mockImplementation(() => {});
		const { calls, fetcher } = cloudflare();

		const res = await handlePurge(
			webhook({ event: 'entry.publish', uid: 'api::post.post' }),
			config,
			fetcher
		);

		expect(res.status).toBe(200);
		expect(calls).toHaveLength(1);
		expect(calls[0].url).toBe('https://api.cloudflare.com/client/v4/zones/zone123/purge_cache');
		expect(new Headers(calls[0].init.headers).get('authorization')).toBe('Bearer cf-token');
		expect(JSON.parse(calls[0].init.body as string)).toEqual({ tags: ['type:post'] });
	});

	it('purges everything on { all: true }', async () => {
		vi.spyOn(console, 'log').mockImplementation(() => {});
		const { calls, fetcher } = cloudflare();

		expect((await handlePurge(webhook({ all: true }), config, fetcher)).status).toBe(200);
		expect(JSON.parse(calls[0].init.body as string)).toEqual({ purge_everything: true });
	});

	it('answers 200 without a purge when there is nothing to do', async () => {
		vi.spyOn(console, 'log').mockImplementation(() => {});
		const { calls, fetcher } = cloudflare();

		const res = await handlePurge(
			webhook({ event: 'entry.update', uid: 'api::post.post' }),
			config,
			fetcher
		);
		expect(res.status).toBe(200);
		expect(calls).toHaveLength(0);
	});

	it('answers 502 when Cloudflare refuses or is unreachable', async () => {
		const error = vi.spyOn(console, 'error').mockImplementation(() => {});
		const body = { event: 'entry.delete', uid: 'api::aside.aside' };

		expect((await handlePurge(webhook(body), config, cloudflare(403).fetcher)).status).toBe(502);
		const down = (() => Promise.reject(new Error('offline'))) as unknown as typeof fetch;
		expect((await handlePurge(webhook(body), config, down)).status).toBe(502);
		expect(error).toHaveBeenCalledTimes(2);
	});

	it('answers 500 when the purge token or zone is missing', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const res = await handlePurge(webhook({ event: 'entry.publish', uid: 'api::post.post' }), {
			...config,
			token: undefined
		});
		expect(res.status).toBe(500);
	});
});

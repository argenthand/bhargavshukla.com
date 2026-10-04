import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('$env/dynamic/private', () => ({ env: {} }));

const { bearerMatches, handlePurge, modelFromUid, planPurge } = await import('./purge');

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
	it('rejects a missing or wrong token without purging', async () => {
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		const { calls, purge } = workersCache();
		const body = { event: 'entry.publish', uid: 'api::post.post' };

		expect((await handlePurge(webhook(body, null), SECRET, purge)).status).toBe(401);
		expect((await handlePurge(webhook(body, 'Bearer nope'), SECRET, purge)).status).toBe(401);
		expect((await handlePurge(webhook(body), undefined, purge)).status).toBe(401);
		expect(calls).toHaveLength(0);
	});

	it('purges the tags, then repopulates with the plan and the body', async () => {
		vi.spyOn(console, 'log').mockImplementation(() => {});
		const { calls, purge } = workersCache();
		const repopulate = vi.fn();
		const body = { event: 'entry.publish', uid: 'api::post.post', entry: { slug: 'a' } };

		const res = await handlePurge(webhook(body), SECRET, purge, repopulate);

		expect(res.status).toBe(200);
		expect(calls).toEqual([{ tags: ['type:post'] }]);
		expect(repopulate).toHaveBeenCalledWith({ action: 'tags', tags: ['type:post'] }, body);
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

// Strapi webhook → purge by Cache-Tag (#17, docs/caching.md → Purge endpoint), then repopulate
// (#123). Pages are tagged `type:<model>` by the edge cache; a content change purges every page
// that read that model, worldwide, within seconds, and the key pages are fetched again at once.

import { MODELS, type Model } from './strapi';

/** Models without Draft & Publish: saving one changes live content right away. */
const NO_DRAFTS: ReadonlySet<Model> = new Set(['category', 'profile', 'tag']);

/** Events that change live content for every model. */
const LIVE_EVENTS = new Set(['entry.publish', 'entry.unpublish', 'entry.delete']);

/** Saves: live for models without Draft & Publish, a draft (nothing to purge) for the rest. */
const SAVE_EVENTS = new Set(['entry.create', 'entry.update']);

export type PurgePlan =
	| { action: 'tags'; tags: string[] }
	| { action: 'everything' }
	| { action: 'ignore'; reason: string };

/** `api::post.post` → `post`, for the content types the site reads; anything else is undefined. */
export function modelFromUid(uid: unknown): Model | undefined {
	const match = typeof uid === 'string' ? /^api::([a-z0-9-]+)\.\1$/.exec(uid) : null;
	return match && Object.hasOwn(MODELS, match[1]) ? (match[1] as Model) : undefined;
}

/** What a webhook body asks for. Strapi 5 sends `{ event, model, uid, entry }`. */
export function planPurge(body: unknown): PurgePlan {
	if (!body || typeof body !== 'object') return { action: 'ignore', reason: 'no payload' };
	const { all, event, uid } = body as { all?: unknown; event?: unknown; uid?: unknown };

	if (all === true) return { action: 'everything' };
	if (typeof event !== 'string') return { action: 'ignore', reason: 'no event' };
	if (event.startsWith('media.')) return { action: 'ignore', reason: event };

	const model = modelFromUid(uid);
	if (!model) return { action: 'ignore', reason: `${event} on ${String(uid)}` };

	if (LIVE_EVENTS.has(event) || (SAVE_EVENTS.has(event) && NO_DRAFTS.has(model))) {
		return { action: 'tags', tags: [`type:${model}`] };
	}
	return { action: 'ignore', reason: `${event} on ${model} (draft only)` };
}

type TimingSafeSubtle = SubtleCrypto & {
	timingSafeEqual?: (a: ArrayBuffer, b: ArrayBuffer) => boolean;
};

/**
 * Checks `Authorization: Bearer <secret>` in constant time. Both sides are hashed first, so
 * `timingSafeEqual` (Workers only) compares equal lengths and leaks nothing about the secret's.
 */
export async function bearerMatches(header: string | null, secret: string): Promise<boolean> {
	if (!secret || !header?.startsWith('Bearer ')) return false;
	const encoder = new TextEncoder();
	const subtle = crypto.subtle as TimingSafeSubtle;
	const [given, expected] = await Promise.all([
		subtle.digest('SHA-256', encoder.encode(header.slice('Bearer '.length))),
		subtle.digest('SHA-256', encoder.encode(secret))
	]);
	if (subtle.timingSafeEqual) return subtle.timingSafeEqual(given, expected);

	// Node (tests, vite dev): same idea without the Workers API.
	const a = new Uint8Array(given);
	const b = new Uint8Array(expected);
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
	return diff === 0;
}

/** Workers Cache's `ctx.cache.purge`, passed in so the endpoint can be tested without Workers. */
export type CachePurge = (options: {
	tags?: string[];
	purgeEverything?: boolean;
}) => Promise<{ success: boolean; errors?: unknown[] }>;

const json = (body: unknown, status: number) => Response.json(body, { status });

/**
 * The whole endpoint, kept here so it can be tested without SvelteKit: 401 on a bad token,
 * 200 when purged or nothing to purge, 502 when the purge fails, 500 without Workers Cache. After
 * a purge, `repopulate` gets the plan and the webhook body (it runs in the background). Every
 * outcome is logged, because Strapi doesn't retry webhooks and failures must show in Workers Logs.
 */
export async function handlePurge(
	request: Request,
	secret: string | undefined,
	purge: CachePurge | undefined,
	repopulate?: (plan: Exclude<PurgePlan, { action: 'ignore' }>, body: unknown) => void
): Promise<Response> {
	if (!secret || !(await bearerMatches(request.headers.get('authorization'), secret))) {
		console.warn('Purge: rejected, bad or missing token');
		return json({ error: 'unauthorized' }, 401);
	}

	const body: unknown = await request.json().catch(() => null);
	const plan = planPurge(body);
	if (plan.action === 'ignore') {
		console.log(`Purge: nothing to do (${plan.reason})`);
		return json({ purged: false, reason: plan.reason }, 200);
	}

	if (!purge) {
		console.error('Purge: Workers Cache is not available (cache.enabled in wrangler.jsonc?)');
		return json({ error: 'purge is not configured' }, 500);
	}

	const what = plan.action === 'everything' ? 'everything' : plan.tags.join(',');
	const result = await purge(
		plan.action === 'everything' ? { purgeEverything: true } : { tags: plan.tags }
	).catch((err: unknown) => ({ success: false, errors: [String(err)] }));

	if (!result.success) {
		console.error(`Purge: failed for ${what}: ${JSON.stringify(result.errors ?? [])}`);
		return json({ error: 'purge failed' }, 502);
	}

	console.log(`Purge: purged ${what}`);
	repopulate?.(plan, body);
	return json({ purged: what }, 200);
}

// Strapi webhook → Cloudflare purge by Cache-Tag (#17, docs/caching.md → Purge endpoint).
// Pages are tagged `type:<model>` by the edge cache (#16); a content change purges every page
// that read that model, worldwide, within seconds.

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

export interface PurgeConfig {
	secret: string | undefined;
	zoneId: string | undefined;
	token: string | undefined;
}

const json = (body: unknown, status: number) => Response.json(body, { status });

/**
 * The whole endpoint, kept here so it can be tested without SvelteKit: 401 on a bad token,
 * 200 when purged or nothing to purge, 502 when Cloudflare refuses. Every outcome is logged,
 * because Strapi doesn't retry webhooks and failures must show in Workers Logs.
 */
export async function handlePurge(
	request: Request,
	config: PurgeConfig,
	fetcher: typeof fetch = fetch
): Promise<Response> {
	if (
		!config.secret ||
		!(await bearerMatches(request.headers.get('authorization'), config.secret))
	) {
		console.warn('Purge: rejected, bad or missing token');
		return json({ error: 'unauthorized' }, 401);
	}

	const plan = planPurge(await request.json().catch(() => null));
	if (plan.action === 'ignore') {
		console.log(`Purge: nothing to do (${plan.reason})`);
		return json({ purged: false, reason: plan.reason }, 200);
	}

	if (!config.zoneId || !config.token) {
		console.error('Purge: CF_ZONE_ID or CF_PURGE_TOKEN is not set');
		return json({ error: 'purge is not configured' }, 500);
	}

	const what = plan.action === 'everything' ? 'everything' : plan.tags.join(',');
	const res = await fetcher(
		`https://api.cloudflare.com/client/v4/zones/${config.zoneId}/purge_cache`,
		{
			method: 'POST',
			headers: { authorization: `Bearer ${config.token}`, 'content-type': 'application/json' },
			body: JSON.stringify(
				plan.action === 'everything' ? { purge_everything: true } : { tags: plan.tags }
			)
		}
	).catch((err: unknown) => err as Error);

	if (res instanceof Error || !res.ok) {
		const detail =
			res instanceof Error ? res.message : `${res.status} ${await res.text().catch(() => '')}`;
		console.error(`Purge: failed for ${what}: ${detail}`);
		return json({ error: 'purge failed' }, 502);
	}

	console.log(`Purge: purged ${what}`);
	return json({ purged: what }, 200);
}

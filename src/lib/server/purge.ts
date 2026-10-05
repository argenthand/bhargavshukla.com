// Strapi webhook → purge by Cache-Tag (#17, docs/caching.md → Purge endpoint), then repopulate
// (#123). The content map (#140) says what a webhook means: a publish purges every page that shows
// its content type, worldwide, within seconds, and the live key pages that show it are fetched
// again at once.

import { planPublish } from './content-map';

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
 * a purge, `repopulate` gets the URLs to fetch again (it runs in the background). Every
 * outcome is logged, because Strapi doesn't retry webhooks and failures must show in Workers Logs.
 */
export async function handlePurge(
	request: Request,
	secret: string | undefined,
	purge: CachePurge | undefined,
	repopulate?: (urls: string[]) => void
): Promise<Response> {
	if (!secret || !(await bearerMatches(request.headers.get('authorization'), secret))) {
		console.warn('Purge: rejected, bad or missing token');
		return json({ error: 'unauthorized' }, 401);
	}

	const body: unknown = await request.json().catch(() => null);
	const plan = planPublish(body);
	if (plan.action === 'ignore') {
		console.log(`Purge: nothing to do (${plan.reason})`);
		return json({ purged: false, reason: plan.reason }, 200);
	}

	if (!purge) {
		console.error('Purge: Workers Cache is not available (cache.enabled in wrangler.jsonc?)');
		return json({ error: 'purge is not configured' }, 500);
	}

	const what = plan.tags ? plan.tags.join(',') : 'everything';
	const result = await purge(plan.tags ? { tags: plan.tags } : { purgeEverything: true }).catch(
		(err: unknown) => ({ success: false, errors: [String(err)] })
	);

	if (!result.success) {
		console.error(`Purge: failed for ${what}: ${JSON.stringify(result.errors ?? [])}`);
		return json({ error: 'purge failed' }, 502);
	}

	console.log(`Purge: purged ${what}`);
	repopulate?.(plan.urls);
	return json({ purged: what }, 200);
}

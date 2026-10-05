// Events in the Worker (#154, docs/analytics.md): what POST /api/events accepts from a page's beacon,
// and how events go on to PostHog EU Cloud. PostHog runs in cookieless server hash mode: every
// event carries the `$posthog_cookieless` placeholder, and PostHog makes the visitor from a daily
// salt, the IP, the User-Agent and the host, then discards the IP. Nothing here throws: analytics
// is never worth an error.

import { MAX_BATCH, PAGE_EVENTS, type BeaconEvent, type ServerEvent } from '$lib/events';
import { site } from '$lib/site';
import type { ContactOutcome } from './contact';

export const POSTHOG_BATCH_URL = 'https://eu.i.posthog.com/batch/';

const PRODUCTION_HOST = new URL(site.url).host;
/** A beacon is a few small events; anything bigger isn't from our page. */
const MAX_BODY = 16_000;
const MAX_TEXT = 500;
const DAY_MS = 86_400_000;

// Most bots never run JavaScript; these are the ones that do (crawlers that render, headless
// browsers, Lighthouse) and plain HTTP clients. PostHog filters known bots too.
const BOTS =
	/bot|crawl|spider|slurp|headless|lighthouse|pagespeed|gtmetrix|curl|wget|python|httpclient|okhttp|go-http|axios|node-fetch|undici|facebookexternalhit|embedly|phantomjs|selenium|puppeteer|playwright/i;

export function isBot(userAgent: string): boolean {
	return !userAgent || BOTS.test(userAgent);
}

/**
 * Whether a request's events count: the read counts' rules (docs/view-counts.md). Only same-origin
 * requests on bhargavshukla.com (not `vite dev` or Workers Builds preview URLs), outside preview
 * mode, and not from a bot. The author's devices don't send at all (`noCount`).
 */
export function counted(request: Request, { preview }: { preview: boolean }): boolean {
	const url = new URL(request.url);
	return (
		!preview &&
		url.host === PRODUCTION_HOST &&
		request.headers.get('origin') === url.origin &&
		!isBot(request.headers.get('user-agent') ?? '')
	);
}

function fits(kind: unknown, value: unknown): unknown {
	if (kind === 'text') return typeof value === 'string' ? value.slice(0, MAX_TEXT) : undefined;
	if (kind === 'number')
		return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
	return Array.isArray(kind) && kind.includes(value) ? value : undefined;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * A beacon's body → the events to forward. Unknown events (and the ones only the server sends)
 * are dropped, and so are properties that aren't the event's or aren't the right kind. A body
 * that's too big, not JSON or has too many events gives nothing.
 */
export function readBeacon(body: string): BeaconEvent[] {
	if (body.length > MAX_BODY) return [];
	let list: unknown;
	try {
		list = JSON.parse(body);
	} catch {
		return [];
	}
	if (!Array.isArray(list) || list.length > MAX_BATCH) return [];
	return list.flatMap((item) => {
		if (
			!isObject(item) ||
			typeof item.event !== 'string' ||
			!Object.hasOwn(PAGE_EVENTS, item.event)
		)
			return [];
		const kinds: Record<string, unknown> = PAGE_EVENTS[item.event as keyof typeof PAGE_EVENTS];
		const given = isObject(item.properties) ? item.properties : {};
		const properties = Object.fromEntries(
			Object.entries(given)
				.filter(([key]) => Object.hasOwn(kinds, key))
				.map(([key, value]) => [key, fits(kinds[key], value)])
				.filter(([, value]) => value !== undefined)
		);
		const age = Number.isFinite(item.age)
			? Math.round(Math.min(Math.max(item.age as number, 0), DAY_MS))
			: 0;
		return [{ event: item.event, properties, age }];
	});
}

export interface Visitor {
	ip: string;
	userAgent: string;
	host: string;
}

export interface PostHogBatch {
	api_key: string;
	batch: {
		event: string;
		distinct_id: string;
		properties: Record<string, unknown>;
		timestamp: string;
	}[];
}

/** Events for PostHog's batch endpoint, timed from when they happened (`age`, from the page). */
export function toPostHog(
	token: string,
	events: { event: string; properties: Record<string, unknown>; age?: number }[],
	visitor: Visitor,
	now = new Date()
): PostHogBatch {
	return {
		api_key: token,
		batch: events.map(({ event, properties, age = 0 }) => ({
			event,
			distinct_id: '$posthog_cookieless',
			properties: {
				...properties,
				$ip: visitor.ip,
				$raw_user_agent: visitor.userAgent,
				$host: visitor.host,
				// No person profiles: a visitor is a daily hash, never a person.
				$process_person_profile: false
			},
			timestamp: new Date(now.getTime() - age).toISOString()
		}))
	};
}

export async function sendToPostHog(batch: PostHogBatch, fetcher: typeof fetch): Promise<void> {
	try {
		const response = await fetcher(POSTHOG_BATCH_URL, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(batch)
		});
		if (!response.ok) console.error(`PostHog ${response.status}: ${await response.text()}`);
	} catch (err) {
		console.error('PostHog unavailable', err);
	}
}

export function visitorOf(request: Request, ip: string): Visitor {
	return {
		ip,
		userAgent: request.headers.get('user-agent') ?? '',
		host: new URL(request.url).host
	};
}

/**
 * POST /api/events: always 204. Events that count go to `send` (the endpoint forwards them in
 * `waitUntil`, after answering). Without a token (not set up yet) nothing is sent.
 */
export async function handleBeacon(
	request: Request,
	{ preview, ip, token }: { preview: boolean; ip: string; token: string | undefined },
	send: (batch: PostHogBatch) => void
): Promise<Response> {
	if (token && counted(request, { preview })) {
		const events = readBeacon(await request.text());
		if (events.length > 0) send(toPostHog(token, events, visitorOf(request, ip)));
	}
	return new Response(null, { status: 204 });
}

/** The contact card's outcomes PostHog hears about: sent, or blocked as spam. */
export function contactEvent(outcome: ContactOutcome): ServerEvent | undefined {
	if (outcome === 'sent' || outcome === 'sent-unverified') return 'contact_sent';
	if (outcome === 'turnstile-failed' || outcome === 'honeypot') return 'contact_blocked';
	return undefined;
}

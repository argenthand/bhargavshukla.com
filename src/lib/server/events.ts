// Events in the Worker (#154, docs/analytics.md): what POST /api/events accepts from a page's beacon,
// and how it's counted. Each event is written to Workers Analytics Engine as a data point: its name,
// the page and its one value. Nothing about the visitor is written: no IP, no User-Agent, no
// country, no ID. Nothing here throws: analytics is never worth an error.

import { MAX_BATCH, PAGE_EVENTS, type ServerEvent } from '$lib/events';
import { site } from '$lib/site';
import type { ContactOutcome } from './contact';

const PRODUCTION_HOST = new URL(site.url).host;
/** A beacon is a few small events; anything bigger isn't from our page. */
const MAX_BODY = 16_000;
const MAX_PATH = 200;

// Most bots never run JavaScript; these are the ones that do (crawlers that render, headless
// browsers, Lighthouse) and plain HTTP clients.
const BOTS =
	/bot|crawl|spider|slurp|headless|lighthouse|pagespeed|gtmetrix|curl|wget|python|httpclient|okhttp|go-http|axios|node-fetch|undici|facebookexternalhit|embedly|phantomjs|selenium|puppeteer|playwright/i;

/**
 * Visitors not counted, by Cloudflare's country code: the EEA (the EU, plus its outermost regions
 * that have their own codes, Iceland, Liechtenstein and Norway), the UK with Gibraltar and the
 * Crown Dependencies, and Switzerland: places with GDPR or a law like it. Their visits aren't
 * counted at all (docs/analytics.md).
 */
export const EXCLUDED_COUNTRIES = new Set([
	// EU
	...['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT'],
	...['LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'],
	// EU regions with codes of their own: Åland, French Guiana, Guadeloupe, Martinique, Réunion,
	// Mayotte, Saint Martin
	...['AX', 'GF', 'GP', 'MQ', 'RE', 'YT', 'MF'],
	// The rest of the EEA, the UK and its dependencies, Switzerland
	...['IS', 'LI', 'NO', 'GB', 'GI', 'IM', 'JE', 'GG', 'CH']
]);

/** Cloudflare's codes for "unknown" and for Tor, where the visitor could be anywhere. */
const UNKNOWN_COUNTRIES = new Set(['XX', 'T1']);

/** Whether a visitor's country is counted: not an excluded one, and known. */
export function countryCounted(country: string | undefined): boolean {
	return !!country && !EXCLUDED_COUNTRIES.has(country) && !UNKNOWN_COUNTRIES.has(country);
}

export function isBot(userAgent: string): boolean {
	return !userAgent || BOTS.test(userAgent);
}

/**
 * Whether a request's events count: the read counts' rules (docs/view-counts.md). Only same-origin
 * requests on bhargavshukla.com (not `vite dev` or Workers Builds preview URLs), outside preview
 * mode, not from a bot, and not from an excluded country. The author's devices don't send at all
 * (`noCount`).
 */
export function counted(
	request: Request,
	{ preview, country }: { preview: boolean; country: string | undefined }
): boolean {
	const url = new URL(request.url);
	return (
		!preview &&
		countryCounted(country) &&
		url.host === PRODUCTION_HOST &&
		request.headers.get('origin') === url.origin &&
		!isBot(request.headers.get('user-agent') ?? '')
	);
}

/** One counted event: its name, the page's path, its value (or '') and its seconds (or 0). */
export interface Count {
	event: string;
	path: string;
	value: string;
	seconds: number;
}

/** The parts of an Analytics Engine dataset used here (binding `EVENTS` in wrangler.jsonc). */
export interface EventsDataset {
	writeDataPoint(point: { indexes: string[]; blobs: string[]; doubles: number[] }): void;
}

const HOST = /^[a-z0-9.-]{1,253}(:\d{1,5})?$/i;
const PATH = /^\/[^?#\s]*$/;

/** The value, if it's the right kind: a non-negative number, a bare host name, or an allowed word. */
function fits(kind: unknown, value: unknown): unknown {
	if (kind === 'number')
		return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
	if (kind === 'host') return typeof value === 'string' && HOST.test(value) ? value : undefined;
	return Array.isArray(kind) && kind.includes(value) ? value : undefined;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * A beacon's body → the counts to write. Unknown events (and the ones only the server sends) are
 * dropped, and so are events whose path isn't a bare path (a query string can hold what a visitor
 * typed). Of the properties, only the event's one value is kept, and only if it's the right kind.
 * A body that's too big, not JSON or has too many events gives nothing.
 */
export function readBeacon(body: string): Count[] {
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
			!Object.hasOwn(PAGE_EVENTS, item.event) ||
			typeof item.path !== 'string' ||
			item.path.length > MAX_PATH ||
			!PATH.test(item.path)
		)
			return [];
		const kinds: Record<string, unknown> = PAGE_EVENTS[item.event as keyof typeof PAGE_EVENTS];
		const given = isObject(item.properties) ? item.properties : {};
		let value = '';
		let seconds = 0;
		for (const [key, kind] of Object.entries(kinds)) {
			const fit = fits(kind, given[key]);
			if (typeof fit === 'number') seconds = Math.round(fit);
			else if (typeof fit === 'string') value = fit;
		}
		return [{ event: item.event, path: item.path, value, seconds }];
	});
}

/**
 * A count as an Analytics Engine data point. `index1` (the event) is what sampling keys on;
 * `blob1` the event, `blob2` the page, `blob3` the value; `double1` the seconds. Queried by
 * `pnpm stats` (scripts/stats.mjs).
 */
export function dataPoint({ event, path, value, seconds }: Count) {
	return { indexes: [event], blobs: [event, path, value], doubles: [seconds] };
}

function write(dataset: EventsDataset | undefined, counts: Count[]) {
	if (!dataset) return; // `vite dev` has no dataset.
	try {
		for (const count of counts) dataset.writeDataPoint(dataPoint(count));
	} catch (err) {
		console.error('Events not written', err);
	}
}

/** POST /api/events: always 204. Counted events are written to the dataset. */
export async function handleBeacon(
	request: Request,
	{
		preview,
		country,
		dataset
	}: { preview: boolean; country: string | undefined; dataset: EventsDataset | undefined }
): Promise<Response> {
	if (counted(request, { preview, country })) write(dataset, readBeacon(await request.text()));
	return new Response(null, { status: 204 });
}

/**
 * An event decided on the server (the contact card's outcome), counted for the page the card was
 * sent from under the beacon's rules, unless `skip` (the author's devices).
 */
export function recordServerEvent(
	name: ServerEvent,
	{
		request,
		preview,
		country,
		skip,
		dataset
	}: {
		request: Request;
		preview: boolean;
		/** Cloudflare's country code for the visitor (`platform.cf.country`). */
		country: string | undefined;
		skip: boolean;
		dataset: EventsDataset | undefined;
	}
): void {
	if (skip || !counted(request, { preview, country })) return;
	write(dataset, [{ event: name, path: new URL(request.url).pathname, value: '', seconds: 0 }]);
}

/** The contact card's outcomes that are counted: sent, or blocked as spam. */
export function contactEvent(outcome: ContactOutcome): ServerEvent | undefined {
	if (outcome === 'sent' || outcome === 'sent-unverified') return 'contact_sent';
	if (outcome === 'turnstile-failed' || outcome === 'honeypot') return 'contact_blocked';
	return undefined;
}

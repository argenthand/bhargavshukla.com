// The analytics beacon (#154, docs/analytics.md): events queue in memory and go to /api/events with
// `navigator.sendBeacon`, where the Worker counts them. Each event is its name, the page's path
// and at most one value. A beacon goes out on each page view, when the page is hidden, when it's
// full, and when a link leaves the site. Nothing is stored in the browser, and the author's
// devices (`noCount`) send nothing. Until `startAnalytics` runs (on the server, before hydration)
// every call does nothing.

import {
	EVENTS_PATH,
	MAX_BATCH,
	type BeaconEvent,
	type PageEvent,
	type Properties
} from './events';
import { optedOut } from './opt-out';

let started = false;
let queue: BeaconEvent[] = [];
/** Run when the page is hidden, before the queue goes: they add what they've measured. */
const onHide = new Set<() => void>();

/**
 * Counts an event on the page at `path` (this one by default). The path only: no query string or
 * fragment, which can hold what a visitor typed (the Writing page's search).
 */
export function track<E extends PageEvent>(
	event: E,
	properties: Properties<E> = {},
	path = location.pathname
) {
	if (!started) return;
	queue.push({ event, path, properties });
	if (queue.length >= MAX_BATCH) flush();
}

function flush() {
	while (queue.length > 0) {
		// Plain text, as the read counts' beacon: no preflight, and the Worker reads it as JSON.
		navigator.sendBeacon(EVENTS_PATH, JSON.stringify(queue.splice(0, MAX_BATCH)));
	}
}

/** The first page view of this page load has gone: later ones are client-side navigations. */
let landed = false;

/**
 * A page view: on load and after each client-side navigation, sent at once. The first carries the
 * site that sent the visitor here (its host only), unless that's this site.
 */
export function pageView() {
	let referrer = '';
	if (!landed) {
		landed = true;
		try {
			const host = document.referrer && new URL(document.referrer).host;
			if (host && host !== location.host) referrer = host;
		} catch {
			// No referrer.
		}
	}
	track('page_view', referrer ? { referrer } : {});
	flush();
}

/**
 * Time spent reading a post or aside at `path`: its visible seconds, sent as `read` each time the
 * page is hidden and when the visitor leaves it, counting from the last report. Returns the
 * cleanup for leaving the page. The path is the page's own: on leaving, the address bar already
 * shows the next page.
 */
export function trackReading(path = location.pathname): () => void {
	let visibleSince: number | undefined = document.hidden ? undefined : performance.now();
	let ms = 0;
	const report = () => {
		if (visibleSince !== undefined) ms += performance.now() - visibleSince;
		visibleSince = undefined;
		const seconds = Math.round(ms / 1000);
		if (seconds >= 1) track('read', { seconds }, path);
		ms = 0;
	};
	const onVisible = () => {
		if (!document.hidden) visibleSince = performance.now();
	};
	onHide.add(report);
	document.addEventListener('visibilitychange', onVisible);
	return () => {
		onHide.delete(report);
		document.removeEventListener('visibilitychange', onVisible);
		report();
	};
}

function onHidden() {
	if (!document.hidden) return;
	for (const hook of onHide) hook();
	flush();
}

/** A followed link to another site (click or middle-click): sent at once, as the page may be about to go. */
function outbound(event: MouseEvent) {
	const link = (event.target as Element | null)?.closest?.('a[href]');
	if (!(link instanceof HTMLAnchorElement)) return;
	const url = new URL(link.href);
	if (!url.protocol.startsWith('http') || url.host === location.host) return;
	track('outbound_link', { host: url.host });
	flush();
}

/** Starts the beacon (the root layout, once). Returns its cleanup. */
export function startAnalytics(): () => void {
	if (optedOut()) return () => {};
	started = true;
	document.addEventListener('visibilitychange', onHidden);
	document.addEventListener('click', outbound, { capture: true });
	document.addEventListener('auxclick', outbound, { capture: true });
	return () => {
		started = false;
		landed = false;
		queue = [];
		onHide.clear();
		document.removeEventListener('visibilitychange', onHidden);
		document.removeEventListener('click', outbound, { capture: true });
		document.removeEventListener('auxclick', outbound, { capture: true });
	};
}

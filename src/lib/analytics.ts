// The analytics beacon (#154, docs/analytics.md): events queue in memory and go to /api/events with
// `navigator.sendBeacon`, which the Worker forwards to PostHog. A beacon goes out on each page view,
// when the page is hidden, when it's full, and when a link leaves the site. Nothing is stored in the
// browser, and the author's devices (`noCount`) send nothing. Until `startAnalytics` runs (on the
// server, before hydration) every call does nothing.

import { EVENTS_PATH, MAX_BATCH, UTM, type PageEvent, type Properties } from './events';
import { optedOut } from './reads';

interface Queued {
	event: PageEvent;
	properties: Record<string, unknown>;
	at: number;
}

let started = false;
let queue: Queued[] = [];
/** Run when the page is hidden, before the queue goes: they add what they've measured. */
const onHide = new Set<() => void>();

// No query string or fragment: they can hold what a visitor typed (the Writing page's search).
const pageProperties = (path = location.pathname) => ({
	$current_url: location.origin + path,
	$pathname: path
});

export function track<E extends PageEvent>(event: E, properties: Properties<E> = {}) {
	if (!started) return;
	queue.push({ event, properties: { ...pageProperties(), ...properties }, at: performance.now() });
	if (queue.length >= MAX_BATCH) flush();
}

function flush() {
	while (queue.length > 0) {
		const now = performance.now();
		const batch = queue.splice(0, MAX_BATCH).map(({ event, properties, at }) => ({
			event,
			properties,
			age: Math.round(now - at)
		}));
		// Plain text, as the read counts' beacon: no preflight, and the Worker reads it as JSON.
		navigator.sendBeacon(EVENTS_PATH, JSON.stringify(batch));
	}
}

/** A page view: on load and after each client-side navigation. Sent at once. */
export function pageview() {
	const params = new URL(location.href).searchParams;
	const utm = Object.fromEntries(
		UTM.filter((key) => params.has(key)).map((key) => [key, params.get(key)!])
	);
	// Only the referring site: a referrer's path and query can hold anything (a webmail inbox, a
	// search). Browsers usually send only the origin to other sites already.
	let referrer: URL | undefined;
	try {
		if (document.referrer) referrer = new URL(document.referrer);
	} catch {
		// Left as direct.
	}
	track('$pageview', {
		$referrer: referrer ? `${referrer.origin}/` : '$direct',
		$referring_domain: referrer?.host ?? '$direct',
		...utm
	});
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
		if (seconds >= 1) track('read', { ...pageProperties(path), seconds });
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

// Core Web Vitals (web-vitals, ~2.4 KB gz), loaded once the page is idle and sent the first time
// it's hidden: web-vitals reports LCP, INP and CLS then, from its own listener on `window`, which
// runs before ours on `document`. They're the page that loaded's, so they're sent with its URL.
const vitals: Record<string, number> = {};
let landing: ReturnType<typeof pageProperties> | undefined;
let vitalsSent = false;
let vitalsLoading = false;

function loadVitals() {
	if (vitalsLoading) return;
	vitalsLoading = true;
	landing = pageProperties();
	const load = () =>
		void import('web-vitals').then(({ onLCP, onINP, onCLS }) => {
			const keep = ({ name, value }: { name: string; value: number }) => (vitals[name] = value);
			onLCP(keep);
			onINP(keep);
			onCLS(keep);
		});
	const whenIdle = () =>
		'requestIdleCallback' in window ? requestIdleCallback(load) : setTimeout(load, 1);
	if (document.readyState === 'complete') whenIdle();
	else addEventListener('load', whenIdle, { once: true });
}

function sendVitals() {
	if (vitalsSent || Object.keys(vitals).length === 0) return;
	vitalsSent = true;
	track('$web_vitals', {
		...landing,
		...Object.fromEntries(
			Object.entries(vitals).map(([name, value]) => [`$web_vitals_${name}_value`, value])
		)
	});
}

function onHidden() {
	if (!document.hidden) return;
	for (const hook of onHide) hook();
	sendVitals();
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
	loadVitals();
	return () => {
		started = false;
		queue = [];
		onHide.clear();
		vitalsSent = false;
		for (const name in vitals) delete vitals[name];
		document.removeEventListener('visibilitychange', onHidden);
		document.removeEventListener('click', outbound, { capture: true });
		document.removeEventListener('auxclick', outbound, { capture: true });
	};
}

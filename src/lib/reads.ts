// Read counts in the browser (#87, docs/view-counts.md): fetching counts, and the beacon.

/** How long a page must be visible before it counts as read. */
export const READ_AFTER_MS = 10_000;
/** Set to anything on the author's own devices so their reads don't count. */
export const NO_COUNT_KEY = 'noCount';

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });

/** 87 → "87 reads", 1234 → "1.2K reads". */
export const formatReads = (count: number) => `${compact.format(count)} reads`;

// Counts asked for in the same tick share one request (the home page shows three).
let queue: { path: string; resolve: (count: number | undefined) => void }[] = [];

async function flush() {
	const batch = queue;
	queue = [];
	let counts: Record<string, number> = {};
	try {
		const query = new URLSearchParams(batch.map(({ path }) => ['path', path]));
		const res = await fetch(`/api/views?${query}`);
		if (res.ok) counts = await res.json();
	} catch {
		// No count is shown.
	}
	for (const { path, resolve } of batch) resolve(counts[path]);
}

/** A page's count, or undefined when it's under 5 reads or couldn't be loaded. */
export function readCount(path: string): Promise<number | undefined> {
	return new Promise((resolve) => {
		if (queue.length === 0) queueMicrotask(flush);
		queue.push({ path, resolve });
	});
}

function optedOut() {
	try {
		return localStorage.getItem(NO_COUNT_KEY) !== null;
	} catch {
		return false;
	}
}

/**
 * Sends the beacon once the page has been visible for `READ_AFTER_MS` in total; time in a
 * background tab doesn't count. Returns a cleanup that cancels it (leaving the page).
 */
export function trackRead(path: string): () => void {
	if (optedOut()) return () => {};
	let remaining = READ_AFTER_MS;
	let started = 0;
	let timer: ReturnType<typeof setTimeout> | undefined;

	const send = () => {
		cleanup();
		navigator.sendBeacon('/api/views', path);
	};
	const resume = () => {
		started = performance.now();
		timer = setTimeout(send, remaining);
	};
	const pause = () => {
		clearTimeout(timer);
		remaining -= performance.now() - started;
	};
	const onVisibility = () => (document.hidden ? pause() : resume());
	const cleanup = () => {
		clearTimeout(timer);
		document.removeEventListener('visibilitychange', onVisibility);
	};

	document.addEventListener('visibilitychange', onVisibility);
	if (!document.hidden) resume();
	return cleanup;
}

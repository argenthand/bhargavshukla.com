// Read counts in the browser (#87): counts asked for together share one request, and the beacon
// goes after ten seconds of the page being visible, not before and not from a background tab.

import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { NO_COUNT_KEY } from '../opt-out';

const { formatReads, readCount, trackRead, READ_AFTER_MS } = await import('../reads');

let visibility: DocumentVisibilityState = 'visible';
Object.defineProperty(document, 'hidden', {
	configurable: true,
	get: () => visibility === 'hidden'
});
function setVisibility(state: DocumentVisibilityState) {
	visibility = state;
	document.dispatchEvent(new Event('visibilitychange'));
}

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
	vi.useRealTimers();
	visibility = 'visible';
	localStorage.clear();
});

describe('formatReads', () => {
	it('says reads, compactly', () => {
		expect(formatReads(87)).toBe('87 reads');
		expect(formatReads(1234)).toBe('1.2K reads');
		expect(formatReads(1_500_000)).toBe('1.5M reads');
	});
});

describe('readCount', () => {
	function counts(body: unknown, ok = true) {
		const fetch = vi.fn(async () => ({ ok, json: async () => body }));
		vi.stubGlobal('fetch', fetch);
		return fetch;
	}

	it('asks once for counts asked for in the same tick, and hands each its own', async () => {
		const fetch = counts({ '/blog/a': 1200, '/blog/b': 40 });
		const [a, b, c] = await Promise.all([
			readCount('/blog/a'),
			readCount('/blog/b'),
			readCount('/blog/quiet')
		]);
		expect(fetch).toHaveBeenCalledOnce();
		const url = new URL((fetch.mock.calls[0] as unknown as [string])[0], location.href);
		expect(url.pathname).toBe('/api/views');
		expect(url.searchParams.getAll('path')).toEqual(['/blog/a', '/blog/b', '/blog/quiet']);
		expect([a, b, c]).toEqual([1200, 40, undefined]); // under 5 reads: left out
	});

	it('asks again for counts asked for later', async () => {
		const fetch = counts({ '/blog/a': 7 });
		await readCount('/blog/a');
		await readCount('/blog/a');
		expect(fetch).toHaveBeenCalledTimes(2);
	});

	it('has no count when the answer is not ok', async () => {
		counts({ '/blog/a': 7 }, false);
		expect(await readCount('/blog/a')).toBeUndefined();
	});

	it('has no count when the request fails', async () => {
		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
		expect(await readCount('/blog/a')).toBeUndefined();
	});
});

describe('trackRead', () => {
	let sendBeacon: MockInstance<Navigator['sendBeacon']>;
	beforeEach(() => {
		vi.useFakeTimers();
		sendBeacon = vi.spyOn(navigator, 'sendBeacon').mockReturnValue(true);
	});

	it('sends the path once the page has been visible for ten seconds, and only once', () => {
		trackRead('/blog/a');
		vi.advanceTimersByTime(READ_AFTER_MS - 1);
		expect(sendBeacon).not.toHaveBeenCalled();
		vi.advanceTimersByTime(1);
		expect(sendBeacon).toHaveBeenCalledWith('/api/views', '/blog/a');
		vi.advanceTimersByTime(60_000);
		expect(sendBeacon).toHaveBeenCalledOnce();
	});

	it('does not count the time in a background tab', () => {
		trackRead('/blog/a');
		vi.advanceTimersByTime(4000);
		setVisibility('hidden');
		vi.advanceTimersByTime(60_000);
		expect(sendBeacon).not.toHaveBeenCalled();
		setVisibility('visible');
		vi.advanceTimersByTime(5999);
		expect(sendBeacon).not.toHaveBeenCalled();
		vi.advanceTimersByTime(1);
		expect(sendBeacon).toHaveBeenCalledOnce();
	});

	it('waits for the page to be shown when it starts in the background', () => {
		visibility = 'hidden';
		trackRead('/blog/a');
		vi.advanceTimersByTime(60_000);
		expect(sendBeacon).not.toHaveBeenCalled();
		setVisibility('visible');
		vi.advanceTimersByTime(READ_AFTER_MS);
		expect(sendBeacon).toHaveBeenCalledOnce();
	});

	it('sends nothing once the visitor has left the page', () => {
		const stop = trackRead('/blog/a');
		vi.advanceTimersByTime(5000);
		stop();
		vi.advanceTimersByTime(60_000);
		setVisibility('hidden');
		setVisibility('visible');
		vi.advanceTimersByTime(60_000);
		expect(sendBeacon).not.toHaveBeenCalled();
	});

	it('sends nothing from the author’s devices', () => {
		localStorage.setItem(NO_COUNT_KEY, '1');
		trackRead('/blog/a');
		vi.advanceTimersByTime(60_000);
		expect(sendBeacon).not.toHaveBeenCalled();
	});
});

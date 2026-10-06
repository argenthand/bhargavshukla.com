// The analytics beacon (#154) in a real browser: what it queues, when it sends, and what it leaves
// out. sendBeacon is faked; visibility is set by hand.

import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { MAX_BATCH, type BeaconEvent } from '../events';
import { NO_COUNT_KEY } from '../opt-out';

const { pageView, startAnalytics, track, trackReading } = await import('../analytics');

let sendBeacon: MockInstance<Navigator['sendBeacon']>;
let stop: () => void;
let visibility: DocumentVisibilityState = 'visible';

Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
Object.defineProperty(document, 'hidden', {
	configurable: true,
	get: () => visibility === 'hidden'
});

function setVisibility(state: DocumentVisibilityState) {
	visibility = state;
	document.dispatchEvent(new Event('visibilitychange'));
}

/** Every beacon sent so far: [url, events]. */
const beacons = () =>
	sendBeacon.mock.calls.map(
		([url, body]) => [url, JSON.parse(body as string) as BeaconEvent[]] as const
	);
const sentEvents = () => beacons().flatMap(([, events]) => events);

beforeEach(() => {
	sendBeacon = vi.spyOn(navigator, 'sendBeacon').mockReturnValue(true);
	stop = startAnalytics();
});

afterEach(() => {
	stop();
	visibility = 'visible';
	sendBeacon.mockRestore();
	localStorage.removeItem(NO_COUNT_KEY);
	history.replaceState(null, '', location.pathname);
	vi.useRealTimers();
	document.body.replaceChildren();
});

describe('pageView', () => {
	it('sends the page view at once: the path, and the referring site on the first page only', () => {
		const referrer = vi
			.spyOn(document, 'referrer', 'get')
			.mockReturnValue('https://www.google.com/search?q=bhargav');
		history.replaceState(null, '', `${location.pathname}?utm_source=newsletter`);
		pageView();
		expect(beacons()).toEqual([
			[
				'/api/events',
				[
					{
						event: 'page_view',
						path: location.pathname,
						properties: { referrer: 'www.google.com' }
					}
				]
			]
		]);
		pageView(); // A client-side navigation: the referrer is still Google's, but it's not news.
		expect(sentEvents()[1]).toEqual({
			event: 'page_view',
			path: location.pathname,
			properties: {}
		});
		referrer.mockRestore();
	});

	it('leaves out a referrer that is this site (a full reload or a link from another page here)', () => {
		const referrer = vi
			.spyOn(document, 'referrer', 'get')
			.mockReturnValue(`${location.origin}/blog`);
		pageView();
		expect(sentEvents()[0].properties).toEqual({});
		referrer.mockRestore();
	});

	it('sends nothing on the author’s devices', () => {
		stop();
		localStorage.setItem(NO_COUNT_KEY, '1');
		stop = startAnalytics();
		pageView();
		expect(sendBeacon).not.toHaveBeenCalled();
	});
});

describe('track', () => {
	it('queues events until the page is hidden, then sends them together to /api/events', () => {
		track('palette_chosen', { palette: 'sage' });
		track('easter_egg_found', { egg: 'disco' });
		expect(sendBeacon).not.toHaveBeenCalled();

		setVisibility('hidden');
		expect(beacons()).toEqual([
			[
				'/api/events',
				[
					{ event: 'palette_chosen', path: location.pathname, properties: { palette: 'sage' } },
					{ event: 'easter_egg_found', path: location.pathname, properties: { egg: 'disco' } }
				]
			]
		]);

		setVisibility('visible');
		setVisibility('hidden');
		expect(beacons()).toHaveLength(1);
	});

	it('sends the path only: no query string or fragment', () => {
		history.replaceState(null, '', `${location.pathname}?q=my+name#top`);
		track('contact_started');
		setVisibility('hidden');
		expect(sentEvents()[0].path).toBe(location.pathname);
	});

	it('sends early once a beacon is full', () => {
		for (let i = 0; i < MAX_BATCH + 1; i++) track('contact_started');
		expect(beacons()).toHaveLength(1);
		expect(sentEvents()).toHaveLength(MAX_BATCH);
		setVisibility('hidden');
		expect(sentEvents()).toHaveLength(MAX_BATCH + 1);
	});

	it('sends a followed link to another site at once, with its host only', () => {
		const away = document.body.appendChild(document.createElement('a'));
		away.href = 'https://github.com/argenthand?tab=repositories';
		away.addEventListener('click', (event) => event.preventDefault());
		const home = document.body.appendChild(document.createElement('a'));
		home.href = '/blog';
		home.addEventListener('click', (event) => event.preventDefault());

		home.click();
		away.click();
		expect(sentEvents()).toEqual([
			{ event: 'outbound_link', path: location.pathname, properties: { host: 'github.com' } }
		]);
	});
});

describe('noCount', () => {
	it('sends nothing on the author’s devices', () => {
		stop();
		localStorage.setItem(NO_COUNT_KEY, '1');
		stop = startAnalytics();
		track('contact_started');
		setVisibility('hidden');
		expect(sendBeacon).not.toHaveBeenCalled();
	});

	it('sends nothing before it starts (on the server, or before hydration)', () => {
		stop();
		track('contact_started');
		setVisibility('hidden');
		expect(sendBeacon).not.toHaveBeenCalled();
		stop = startAnalytics();
	});
});

describe('trackReading', () => {
	it('sends the visible seconds since the last report each time the page is hidden, and on leaving', () => {
		vi.useFakeTimers({ toFake: ['performance'] });
		const leave = trackReading();
		vi.advanceTimersByTime(42_000);
		setVisibility('hidden');
		vi.advanceTimersByTime(60_000); // In another tab: not reading.
		setVisibility('visible');
		vi.advanceTimersByTime(8_400);
		leave();
		setVisibility('hidden');
		expect(sentEvents().map((e) => [e.event, e.properties.seconds])).toEqual([
			['read', 42],
			['read', 8]
		]);
	});

	it('sends the post it was reading, even once the visitor has moved on', () => {
		vi.useFakeTimers({ toFake: ['performance'] });
		const back = location.pathname;
		history.replaceState(null, '', '/blog/a-post');
		const leave = trackReading();
		vi.advanceTimersByTime(5_000);
		history.replaceState(null, '', '/blog'); // A client-side navigation away.
		leave();
		setVisibility('hidden');
		history.replaceState(null, '', back);
		expect(sentEvents()).toEqual([
			{ event: 'read', path: '/blog/a-post', properties: { seconds: 5 } }
		]);
	});

	it('sends nothing for under a second', () => {
		vi.useFakeTimers({ toFake: ['performance'] });
		const leave = trackReading();
		vi.advanceTimersByTime(400);
		leave();
		setVisibility('hidden');
		expect(sendBeacon).not.toHaveBeenCalled();
	});
});

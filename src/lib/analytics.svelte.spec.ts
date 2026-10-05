// The analytics beacon (#154) in a real browser: what it queues, when it sends, and what it leaves
// out. sendBeacon is faked; visibility is set by hand.

import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { MAX_BATCH } from './events';
import { NO_COUNT_KEY } from './reads';

const vitals = vi.hoisted(() => ({
	onLCP: vi.fn(),
	onINP: vi.fn(),
	onCLS: vi.fn()
}));
vi.mock('web-vitals', () => vitals);

const { pageview, startAnalytics, track, trackReading } = await import('./analytics');

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

interface Sent {
	event: string;
	properties: Record<string, unknown>;
	age: number;
}

/** Every beacon sent so far: [url, events]. */
const beacons = () =>
	sendBeacon.mock.calls.map(([url, body]) => [url, JSON.parse(body as string) as Sent[]] as const);
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

describe('pageview', () => {
	it('sends the page view at once, with the page, the referrer and UTM parameters', () => {
		history.replaceState(
			null,
			'',
			`${location.pathname}?utm_source=newsletter&utm_medium=email&x=1#section`
		);
		pageview();
		expect(beacons()).toHaveLength(1);
		const [[url, [event]]] = beacons();
		expect(url).toBe('/api/events');
		expect(event.event).toBe('$pageview');
		expect(event.properties).toMatchObject({
			$current_url: location.origin + location.pathname,
			$pathname: location.pathname,
			utm_source: 'newsletter',
			utm_medium: 'email'
		});
		expect(event.properties).not.toHaveProperty('x');
		expect(event.properties.$referrer).toBe(
			document.referrer ? `${new URL(document.referrer).origin}/` : '$direct'
		);
		expect(event.age).toBeGreaterThanOrEqual(0);
	});
});

describe('track', () => {
	it('queues events until the page is hidden, then sends them together', () => {
		track('palette_chosen', { palette: 'sage' });
		track('easter_egg_found', { egg: 'disco' });
		expect(sendBeacon).not.toHaveBeenCalled();

		setVisibility('hidden');
		expect(beacons()).toHaveLength(1);
		expect(sentEvents().map((e) => [e.event, e.properties.palette ?? e.properties.egg])).toEqual([
			['palette_chosen', 'sage'],
			['easter_egg_found', 'disco']
		]);
		expect(sentEvents()[0].properties.$pathname).toBe(location.pathname);

		setVisibility('visible');
		setVisibility('hidden');
		expect(beacons()).toHaveLength(1);
	});

	it('says how long ago each event happened', () => {
		vi.useFakeTimers({ toFake: ['performance'] });
		track('contact_started');
		vi.advanceTimersByTime(3000);
		track('resume_printed');
		setVisibility('hidden');
		expect(sentEvents().map((e) => e.age)).toEqual([3000, 0]);
	});

	it('sends early once a beacon is full', () => {
		for (let i = 0; i < MAX_BATCH + 1; i++) track('contact_started');
		expect(beacons()).toHaveLength(1);
		expect(sentEvents()).toHaveLength(MAX_BATCH);
		setVisibility('hidden');
		expect(sentEvents()).toHaveLength(MAX_BATCH + 1);
	});

	it('sends a followed link to another site at once, with its host', () => {
		const away = document.body.appendChild(document.createElement('a'));
		away.href = 'https://github.com/argenthand';
		away.addEventListener('click', (event) => event.preventDefault());
		const home = document.body.appendChild(document.createElement('a'));
		home.href = '/blog';
		home.addEventListener('click', (event) => event.preventDefault());

		home.click();
		away.click();
		expect(sentEvents().map((e) => [e.event, e.properties.host])).toEqual([
			['outbound_link', 'github.com']
		]);
	});
});

describe('noCount', () => {
	it('sends nothing on the author’s devices', () => {
		stop();
		localStorage.setItem(NO_COUNT_KEY, '1');
		stop = startAnalytics();
		pageview();
		track('contact_started');
		setVisibility('hidden');
		expect(sendBeacon).not.toHaveBeenCalled();
	});

	it('sends nothing before it starts (on the server, or before hydration)', () => {
		stop();
		pageview();
		track('contact_started');
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
		const [event] = sentEvents();
		expect(event.properties).toMatchObject({
			$pathname: '/blog/a-post',
			$current_url: `${location.origin}/blog/a-post`,
			seconds: 5
		});
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

describe('web vitals', () => {
	it('loads web-vitals once the page is idle, and sends what it has when first hidden, for the page that loaded', async () => {
		await vi.waitFor(() => expect(vitals.onCLS).toHaveBeenCalled());
		vitals.onLCP.mock.calls.at(-1)![0]({ name: 'LCP', value: 812.5 });
		vitals.onCLS.mock.calls.at(-1)![0]({ name: 'CLS', value: 0.02 });
		const landingPath = location.pathname;
		history.pushState(null, '', '/elsewhere'); // A client-side navigation before leaving.
		setVisibility('hidden');
		history.replaceState(null, '', landingPath);
		const [event] = sentEvents();
		expect(event.event).toBe('$web_vitals');
		expect(event.properties).toMatchObject({
			$web_vitals_LCP_value: 812.5,
			$web_vitals_CLS_value: 0.02
		});
		expect(event.properties).not.toHaveProperty('$web_vitals_INP_value');
		expect(event.properties.$pathname).toBe(landingPath);

		setVisibility('visible');
		vitals.onINP.mock.calls.at(-1)![0]({ name: 'INP', value: 40 });
		setVisibility('hidden');
		expect(sentEvents().filter((e) => e.event === '$web_vitals')).toHaveLength(1);
	});
});

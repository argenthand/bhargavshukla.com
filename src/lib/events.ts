// Events (#154, docs/analytics.md; CONTEXT.md → Analytics): what a page's beacon may send, and the
// properties each may carry. The beacon (src/lib/analytics.ts) is typed from this, and the Worker
// (src/lib/server/events.ts) drops anything that doesn't fit it.

import { PALETTES } from './palettes';

/** A property's kind: free text, a number, or one of a few words. */
type Kind = 'text' | 'number' | readonly string[];

export const EGGS = ['8-bit', 'disco', 'tab-lap', 'abyss'] as const;

/** On every event the page sends: where it happened. */
const PAGE = { $current_url: 'text', $pathname: 'text' } as const;

/** The UTM parameters a page view carries when its URL has them. */
export const UTM = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const;

/** The events a page sends. `$pageview` and `$web_vitals` are the names PostHog's web analytics reads. */
export const PAGE_EVENTS = {
	$pageview: {
		...PAGE,
		$referrer: 'text',
		$referring_domain: 'text',
		...(Object.fromEntries(UTM.map((key) => [key, 'text'])) as Record<(typeof UTM)[number], 'text'>)
	},
	$web_vitals: {
		...PAGE,
		$web_vitals_LCP_value: 'number',
		$web_vitals_INP_value: 'number',
		$web_vitals_CLS_value: 'number'
	},
	read: { ...PAGE, seconds: 'number' },
	easter_egg_found: { ...PAGE, egg: EGGS },
	palette_chosen: { ...PAGE, palette: PALETTES.map((palette) => palette.id) },
	resume_printed: PAGE,
	contact_started: PAGE,
	outbound_link: { ...PAGE, host: 'text' }
} as const satisfies Record<string, Record<string, Kind>>;

/** Events only the Worker sends: the contact card's outcome, decided on the server. */
export const SERVER_EVENTS = ['contact_sent', 'contact_blocked'] as const;

export type PageEvent = keyof typeof PAGE_EVENTS;
export type ServerEvent = (typeof SERVER_EVENTS)[number];

type Value<K> = K extends 'text'
	? string
	: K extends 'number'
		? number
		: K extends readonly (infer W)[]
			? W
			: never;

/** An event's properties, each optional (the page adds `$current_url` and `$pathname`). */
export type Properties<E extends PageEvent> = {
	[P in keyof (typeof PAGE_EVENTS)[E]]?: Value<(typeof PAGE_EVENTS)[E][P]>;
};

/** One event in a beacon: `age` is how many milliseconds ago it happened. */
export interface BeaconEvent {
	event: string;
	properties: Record<string, unknown>;
	age: number;
}

/** The most events one beacon carries; the page sends early when it has this many. */
export const MAX_BATCH = 10;
/** Where beacons go. */
export const EVENTS_PATH = '/api/events';
/** A form field the contact card adds on the author's devices (`noCount`), so its outcome isn't sent. */
export const NO_COUNT_FIELD = 'no-count';

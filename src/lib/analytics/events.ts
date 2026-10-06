// Events (#154, docs/analytics.md; CONTEXT.md → Analytics): what a page's beacon may send. Each
// event is a count: its name, the page it happened on, and at most one value. The beacon
// (src/lib/analytics/analytics.ts) is typed from this, and the Worker (src/lib/analytics/server/events.ts) drops
// anything that doesn't fit it.

/** A value's kind: a number, a host name (`github.com`), or one of a few words. */
type Kind = 'number' | 'host' | readonly string[];

export const EGGS = ['8-bit', 'disco', 'tab-lap', 'abyss'] as const;

/** The look's palette ids, spelled out so analytics never imports the look (#161); events.spec.ts keeps them in step. */
const PALETTE_IDS = ['newsprint', 'harbour', 'sage', 'plum', 'ochre'] as const;

/** The events a page sends, and the one value each may carry. */
export const PAGE_EVENTS = {
	/** `referrer`: the site that sent the visitor here, on the first page of a visit only. */
	page_view: { referrer: 'host' },
	read: { seconds: 'number' },
	easter_egg_found: { egg: EGGS },
	palette_chosen: { palette: PALETTE_IDS },
	resume_printed: {},
	contact_started: {},
	outbound_link: { host: 'host' }
} as const satisfies Record<string, Record<string, Kind>>;

/** Events only the Worker sends: the contact card's outcome, decided on the server. */
export const SERVER_EVENTS = ['contact_sent', 'contact_blocked'] as const;

export type PageEvent = keyof typeof PAGE_EVENTS;
export type ServerEvent = (typeof SERVER_EVENTS)[number];

type Value<K> = K extends 'number'
	? number
	: K extends 'host'
		? string
		: K extends readonly (infer W)[]
			? W
			: never;

/** An event's value, by its name (`{ egg: 'disco' }`). */
export type Properties<E extends PageEvent> = {
	[P in keyof (typeof PAGE_EVENTS)[E]]?: Value<(typeof PAGE_EVENTS)[E][P]>;
};

/** One event in a beacon: `path` is the page's path, without a query string or fragment. */
export interface BeaconEvent {
	event: string;
	path: string;
	properties: Record<string, unknown>;
}

/** The most events one beacon carries; the page sends early when it has this many. */
export const MAX_BATCH = 10;
/** Where beacons go. */
export const EVENTS_PATH = '/api/events';
/** A form field the contact card adds on the author's devices (`noCount`), so its outcome isn't counted. */
export const NO_COUNT_FIELD = 'no-count';

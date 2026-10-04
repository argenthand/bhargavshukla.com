// Easter eggs (#63, docs/design.md → Easter eggs): small surprises for people who go looking.
// None of them may change the normal reading experience.

/** True while the reader is typing, so shortcuts and the Konami code stay out of the way. */
export function isTyping(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) return false;
	return (
		target.isContentEditable ||
		target instanceof HTMLInputElement ||
		target instanceof HTMLTextAreaElement ||
		target instanceof HTMLSelectElement
	);
}

export const KONAMI = [
	'arrowup',
	'arrowup',
	'arrowdown',
	'arrowdown',
	'arrowleft',
	'arrowright',
	'arrowleft',
	'arrowright',
	'b',
	'a'
];

/** Feeds keys one at a time; returns true on the key that completes ↑↑↓↓←→←→BA. */
export function konamiMatcher() {
	let recent: string[] = [];
	return (key: string) => {
		recent = [...recent, key.toLowerCase()].slice(-KONAMI.length);
		const done = recent.length === KONAMI.length && recent.every((k, i) => k === KONAMI[i]);
		if (done) recent = [];
		return done;
	};
}

/** How each Konami key shows on the controller's strip (#111). */
export const KEY_SYMBOLS: Record<string, string> = {
	arrowup: '↑',
	arrowdown: '↓',
	arrowleft: '←',
	arrowright: '→',
	b: 'B',
	a: 'A'
};

/**
 * Counts quick taps (#111: three on the © line, five on the current tab): returns true on the tap
 * that makes `count` within `windowMs`, then starts over.
 */
export function tapCounter(count: number, windowMs: number, now = () => Date.now()) {
	let taps: number[] = [];
	return () => {
		const t = now();
		taps = [...taps.filter((tap) => t - tap < windowMs), t];
		if (taps.length < count) return false;
		taps = [];
		return true;
	};
}

/** The palette disco (#111): every other palette in picker order, ending back on the current one. */
export function discoOrder<T>(palettes: readonly T[], current: T): T[] {
	const i = Math.max(palettes.indexOf(current), 0);
	return [...palettes.slice(i + 1), ...palettes.slice(0, i), palettes[i]];
}

/** Under the footer, only where the page bounces past its end (iOS and macOS Safari). */
export const ABYSS_LINE = 'Welcome to the abyss.';

/** The 404 page's extra line. Draft copy: edit freely. */
export const NOT_FOUND_LINES = [
	'I looked under the couch. Nothing.',
	'This link took a wrong turn somewhere.',
	"Either the page moved, or I never wrote it. I bet it's the latter.",
	'Even well-run systems have a 404 or two.'
];

/**
 * One line per path: the same on the server and in the browser (so hydration matches), different
 * from one broken link to the next.
 */
export function notFoundLine(path: string): string {
	let hash = 0;
	for (const char of path) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
	return NOT_FOUND_LINES[hash % NOT_FOUND_LINES.length];
}

/** For engineers who open DevTools. Draft copy: edit freely. */
export function consoleNote() {
	console.log(
		"If you're reading this, we probably have things to talk about. My contact links are on the home page; say hi.\n\nPress ? on any page for keyboard shortcuts."
	);
}

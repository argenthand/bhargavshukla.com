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

const KONAMI = [
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

/** The 404 page's extra line. Draft copy: edit freely. */
export const NOT_FOUND_LINES = [
	'I looked under the couch. Nothing.',
	'This link took a wrong turn somewhere.',
	'Either the page moved, or I never wrote it. I’d bet on the second.',
	'Somewhere a redirect is missing. That one’s on me.',
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
	console.log('%cHi, I’m Bhargav.', 'font: 600 20px Newsreader, Georgia, serif; color: #b91c1c');
	console.log(
		'If you’re reading this, we probably have things to talk about. My contact links are on the home page; say hi.\n\nPress ? on any page for keyboard shortcuts.'
	);
}

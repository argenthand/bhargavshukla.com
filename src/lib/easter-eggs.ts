// Easter eggs (#63, docs/design.md → Easter eggs; CONTEXT.md): their copy. The gestures that find
// them are in gestures.ts (#143).

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

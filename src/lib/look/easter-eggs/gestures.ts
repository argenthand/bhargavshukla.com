// Gestures (#143, CONTEXT.md): what a visitor does to find an easter egg. Quick taps on one thing,
// or the Konami code from the keyboard or the controller. A gesture only says it happened: each egg
// decides what follows (8-bit mode listens for the Konami code). Neither checks reduced motion; the
// effects do.

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

/**
 * Keys that shortcuts and the Konami code leave alone: typing in a field, IME composition, chords
 * with Ctrl/⌘/Alt (so browser and screen reader shortcuts keep working), and keys already handled.
 */
export function leaveKeyAlone(event: KeyboardEvent): boolean {
	return (
		event.defaultPrevented ||
		event.isComposing ||
		isTyping(event.target) ||
		event.ctrlKey ||
		event.metaKey ||
		event.altKey
	);
}

/**
 * `count` quick taps (clicks) on the element, all within `windowMs`: `onDone` gets the click that
 * made the count, and counting starts over. `{@attach taps(5, swapPhoto)}`.
 */
export function taps(
	count: number,
	onDone: (event: MouseEvent) => void,
	{ windowMs = 2000 } = {}
): (element: HTMLElement) => () => void {
	return (element) => {
		let recent: number[] = [];
		const onclick = (event: MouseEvent) => {
			const now = Date.now();
			recent = [...recent.filter((tap) => now - tap < windowMs), now];
			if (recent.length < count) return;
			recent = [];
			onDone(event);
		};
		element.addEventListener('click', onclick);
		return () => element.removeEventListener('click', onclick);
	};
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

/** The last keys pressed, from the keyboard and the controller alike: one sequence. */
let recent: string[] = [];

const konamiListeners = new Set<() => void>();

/** Calls `listener` whenever the Konami code is completed. Returns how to stop listening. */
export function onKonami(listener: () => void): () => void {
	konamiListeners.add(listener);
	return () => konamiListeners.delete(listener);
}

/** One key of the Konami code (the controller's presses come here). True on the key that completes it. */
export function konamiKey(key: string): boolean {
	recent = [...recent, key.toLowerCase()].slice(-KONAMI.length);
	if (recent.length < KONAMI.length || recent.some((k, i) => k !== KONAMI[i])) return false;
	recent = [];
	for (const listener of konamiListeners) listener();
	return true;
}

/**
 * The keyboard's way in: `<svelte:window onkeydown={konamiKeydown} />`. Not keys left alone, and not
 * keys aimed at the controller (`data-konami-pad`): Enter or Space there presses a button, and the
 * button sends its own key.
 */
export function konamiKeydown(event: KeyboardEvent) {
	if (leaveKeyAlone(event)) return;
	if (event.target instanceof Element && event.target.closest('[data-konami-pad]')) return;
	konamiKey(event.key);
}

/** How far past the end of the page a scroll must go to count as a bounce into the abyss. */
const BOUNCE_PX = 40;

/**
 * Whether the page has bounced past its end (the abyss, #111): Safari reports the rubber-band
 * bounce as a scroll beyond the bottom; other browsers never scroll that far.
 */
export function bouncedPastEnd(): boolean {
	return scrollY + innerHeight >= document.documentElement.scrollHeight + BOUNCE_PX;
}

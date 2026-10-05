// Gestures (#143, CONTEXT.md): what a visitor does to find an easter egg. Quick taps on one thing,
// or the Konami code from the keyboard or the controller. A gesture only says it happened; each
// egg decides what follows, and whether reduced motion changes it.

import { unlock } from '$lib/eight-bit.svelte';

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

/** How each Konami key shows on the controller's strip (#111). */
export const KEY_SYMBOLS: Record<string, string> = {
	arrowup: '↑',
	arrowdown: '↓',
	arrowleft: '←',
	arrowright: '→',
	b: 'B',
	a: 'A'
};

/** The last keys pressed, from the keyboard and the controller alike: one sequence. */
let recent: string[] = [];

/** One key of the Konami code (the controller's presses come here). True on the key that completes it. */
export function konamiKey(key: string): boolean {
	recent = [...recent, key.toLowerCase()].slice(-KONAMI.length);
	if (recent.length < KONAMI.length || recent.some((k, i) => k !== KONAMI[i])) return false;
	recent = [];
	void unlock();
	return true;
}

/** The keyboard's way in: `<svelte:window onkeydown={konamiKeydown} />`. Not while typing or in a chord. */
export function konamiKeydown(event: KeyboardEvent) {
	if (event.defaultPrevented || event.isComposing || isTyping(event.target)) return;
	if (event.ctrlKey || event.metaKey || event.altKey) return;
	konamiKey(event.key);
}

// The palette disco (#111, EGG-palette-disco on the canvas): every palette in turn, 0.4 s each,
// with a burst of confetti in each (not with reduced motion), then back to where it started with a
// line at the bottom. Nothing is saved; a tap anywhere stops it early. PalettePicker.svelte loads
// this on the fifth quick tap on the dot, so it costs nothing otherwise.

import { track } from '$lib/analytics';
import { reducedMotion, showToast } from '$lib/site';
import { look, PALETTES } from '$lib/look.svelte';

/** Every other palette in picker order, ending back on the current one. */
export function discoOrder<T>(palettes: readonly T[], current: T): T[] {
	const i = Math.max(palettes.indexOf(current), 0);
	return [...palettes.slice(i + 1), ...palettes.slice(0, i), palettes[i]];
}

/** How long each palette shows. */
const STEP_MS = 400;
/** Confetti per palette: a short burst, so they don't pile up. */
const CONFETTI_MS = 300;

export async function disco() {
	track('easter_egg_found', { egg: 'disco' });
	const start = look.palette;
	let stopped = false;
	const stop = () => (stopped = true);
	// Let the press that started it finish before listening for the tap that stops it.
	setTimeout(() => document.addEventListener('pointerdown', stop, { once: true }));
	const confetti = reducedMotion() ? null : (await import('$lib/confetti')).confetti;
	const ids = PALETTES.map((p) => p.id);
	for (const id of discoOrder(ids, start)) {
		if (stopped) break;
		look.showPalette(id);
		confetti?.({ durationMs: CONFETTI_MS });
		await new Promise((done) => setTimeout(done, STEP_MS));
	}
	document.removeEventListener('pointerdown', stop);
	look.showPalette(null);
	showToast(`Back to ${look.paletteLabel}. Pick any of them from the dot.`);
}

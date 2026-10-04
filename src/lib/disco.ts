// The palette disco (#111, EGG-palette-disco on the canvas): every palette in turn, 0.4 s each,
// with a burst of confetti in each (not with reduced motion), then back to where it started with a
// line at the bottom. Nothing is saved; a tap anywhere stops it early. PalettePicker.svelte loads
// this when a long press on the dot completes, so it costs nothing otherwise.

import { discoOrder } from '$lib/easter-eggs';
import { reducedMotion } from '$lib/motion';
import { PALETTES, type PaletteId } from '$lib/theme';
import { showToast } from '$lib/toast.svelte';

/** How long each palette shows. */
const STEP_MS = 400;
/** Confetti per palette: a short burst, so they don't pile up. */
const CONFETTI_MS = 300;

export async function disco(start: PaletteId) {
	const root = document.documentElement;
	let stopped = false;
	const stop = () => (stopped = true);
	// Let the press that started it finish before listening for the tap that stops it.
	setTimeout(() => document.addEventListener('pointerdown', stop, { once: true }));
	const confetti = reducedMotion() ? null : (await import('$lib/confetti')).confetti;
	const ids = PALETTES.map((p) => p.id);
	for (const id of discoOrder(ids, start)) {
		if (stopped) break;
		root.dataset.palette = id;
		confetti?.({ durationMs: CONFETTI_MS });
		await new Promise((done) => setTimeout(done, STEP_MS));
	}
	document.removeEventListener('pointerdown', stop);
	root.dataset.palette = start;
	const name = PALETTES.find((p) => p.id === start)?.label;
	showToast(`Back to ${name}. Pick any of them from the dot.`);
}

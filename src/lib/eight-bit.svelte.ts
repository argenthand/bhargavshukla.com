// 8-bit mode (#111, NES-A-* on the canvas): the Konami code's reward. An exclusive NES palette
// (Night) with pixel fonts, for this visit only: it lives in sessionStorage, so the next visit is
// back to the saved palette, which it never touches. `data-eight-bit` on <html> turns it on; the inline
// script in app.html sets it before the first paint (keep the two in step). Screen only: the
// resume prints in the palette underneath.

import { reducedMotion } from '$lib/motion';
import { play, type Sound } from '$lib/eight-bit-sound';
import { isPalette, PALETTES } from '$lib/theme';
import { showToast } from '$lib/toast.svelte';

export const NES_KEY = 'nes';
export const SOUND_KEY = 'nes-sound';

/** Whether 8-bit mode is on, and whether its blips play. Read from <html> once hydrated. */
export const nes = $state({ on: false, sound: true });

export function readNes() {
	nes.on = document.documentElement.hasAttribute('data-eight-bit');
	try {
		nes.sound = sessionStorage.getItem(SOUND_KEY) !== 'off';
	} catch {
		// Storage blocked: sound stays on.
	}
}

export function setNes(on: boolean) {
	try {
		if (on) sessionStorage.setItem(NES_KEY, '1');
		else sessionStorage.removeItem(NES_KEY);
	} catch {
		// Storage blocked: it still applies to this page.
	}
	document.documentElement.toggleAttribute('data-eight-bit', on);
	nes.on = on;
}

export function setSound(on: boolean) {
	try {
		sessionStorage.setItem(SOUND_KEY, on ? 'on' : 'off');
	} catch {
		// Storage blocked: it still applies to this page.
	}
	nes.sound = on;
}

/** A blip, unless muted. */
export function blip(sound: Sound) {
	if (nes.sound) play(sound);
}

/** The palette under 8-bit mode: what "Back to …" returns to. */
export function paletteLabel(): string {
	const id = document.documentElement.dataset.palette;
	return PALETTES.find((p) => p.id === (isPalette(id) ? id : 'newsprint'))!.label;
}

/** The Konami code, from the keyboard or the controller. */
export async function unlock() {
	const already = nes.on;
	setNes(true);
	blip('unlock');
	showToast(already ? '↑↑↓↓←→←→BA. Still 8-bit.' : '↑↑↓↓←→←→BA. 8-bit mode unlocked.');
	if (reducedMotion()) return;
	const { confetti } = await import('$lib/confetti');
	confetti({ vars: ['--night-red', '--night-orange', '--night-sky', '--night-green'] });
}

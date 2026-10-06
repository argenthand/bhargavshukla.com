// 8-bit mode's behaviour (#111, NES-A-* on the canvas; CONTEXT.md): its blips and their sound
// switch, and the Konami code's unlock. Whether it's on is part of the look (src/lib/look.svelte.ts):
// Night's colours and pixel fonts over the palette, for this visit only. Screen only: the resume
// prints in the palette underneath.

import { track } from '$lib/analytics';
import { reducedMotion, showToast } from '$lib/site';
import { play, type Sound } from './eight-bit-sound';
import { look } from '../look.svelte';

const SOUND_KEY = 'eight-bit-sound';

/** Whether 8-bit mode's blips play: on unless muted this visit. */
export const sound = $state({ on: readSound() });

function readSound() {
	try {
		return typeof sessionStorage === 'undefined' || sessionStorage.getItem(SOUND_KEY) !== 'off';
	} catch {
		return true; // Storage blocked: sound stays on.
	}
}

export function setSound(on: boolean) {
	try {
		sessionStorage.setItem(SOUND_KEY, on ? 'on' : 'off');
	} catch {
		// Storage blocked: it still applies to this page.
	}
	sound.on = on;
}

/** A blip, unless muted. */
export function blip(name: Sound) {
	if (sound.on) play(name);
}

/** The Konami code, from the keyboard or the controller. */
export async function unlock() {
	const already = look.eightBit;
	look.setEightBit(true);
	if (!already) track('easter_egg_found', { egg: '8-bit' });
	blip('unlock');
	showToast(already ? '↑↑↓↓←→←→BA. Still 8-bit.' : '↑↑↓↓←→←→BA. 8-bit mode unlocked.');
	if (reducedMotion()) return;
	const { confetti } = await import('../confetti');
	confetti({ vars: ['--night-red', '--night-orange', '--night-sky', '--night-green'] });
}

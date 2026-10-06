// 8-bit mode's sounds (#111): short blips made on the spot with Web Audio square waves (the NES's
// pulse channels), so there are no files to download and nothing copied from a game. Measured: about
// 0.5 KB gzipped and under 0.3 ms per blip (docs/design.md → Easter eggs).
//
// Browsers only start audio from a tap, click or key press, and iOS only from a completed tap, so
// the context is created or resumed inside those handlers. It's suspended after a quiet spell so
// the audio hardware can sleep, except while the controller is open (its presses land on
// pointerdown, which can't wake it on iOS).

type Note = [frequency: number, start: number, length: number];

export const SOUNDS = {
	press: [[880, 0, 0.05]], // the controller's d-pad, B and A
	select: [
		[660, 0, 0.04],
		[990, 0.04, 0.06]
	], // buttons and links in 8-bit mode; Select and Start
	back: [
		[660, 0, 0.05],
		[440, 0.05, 0.08]
	], // Back to <palette>
	unlock: [
		[523, 0, 0.08],
		[659, 0.08, 0.08],
		[784, 0.16, 0.08],
		[1047, 0.24, 0.2]
	]
} satisfies Record<string, Note[]>;

export type Sound = keyof typeof SOUNDS;

const VOLUME = 0.06;
const IDLE_MS = 2000;

let ctx: AudioContext | undefined;
let idle: ReturnType<typeof setTimeout> | undefined;
let awake = false;

/** Keeps the audio running (the controller is open) or lets it sleep again. */
export function keepAwake(on: boolean) {
	awake = on;
	if (on) clearTimeout(idle);
	else sleepSoon();
}

function sleepSoon() {
	clearTimeout(idle);
	if (!awake) idle = setTimeout(() => void ctx?.suspend(), IDLE_MS);
}

/** Starts the audio from inside a tap or key handler, so the next blip is instant. */
export function wake() {
	if (typeof AudioContext === 'undefined') return;
	ctx ??= new AudioContext();
	if (ctx.state === 'suspended') void ctx.resume();
	sleepSoon();
}

export function play(sound: Sound) {
	wake();
	if (!ctx) return;
	const now = ctx.currentTime;
	for (const [frequency, start, length] of SOUNDS[sound]) {
		const oscillator = ctx.createOscillator();
		const gain = ctx.createGain();
		oscillator.type = 'square';
		oscillator.frequency.value = frequency;
		gain.gain.setValueAtTime(VOLUME, now + start);
		gain.gain.exponentialRampToValueAtTime(0.0001, now + start + length);
		oscillator.connect(gain).connect(ctx.destination);
		oscillator.start(now + start);
		oscillator.stop(now + start + length);
	}
}

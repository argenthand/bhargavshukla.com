// 8-bit mode's behaviour (#111): the Konami code unlocks it, announces it, counts it once, and
// throws Night's confetti unless motion is reduced; the blips follow a sound switch that lasts for
// this visit.

import { afterEach, describe, expect, it, vi } from 'vitest';

const { track, play, confetti, reduced, showToast } = vi.hoisted(() => ({
	track: vi.fn(),
	showToast: vi.fn(),
	play: vi.fn(),
	confetti: vi.fn(),
	reduced: vi.fn(() => false)
}));

vi.mock('$lib/analytics', () => ({ track }));
vi.mock('$lib/site', async (original) => ({
	...(await original<typeof import('$lib/site')>()),
	reducedMotion: reduced,
	showToast
}));
vi.mock('../../eight-bit/eight-bit-sound', () => ({ play }));
vi.mock('../../confetti', () => ({ confetti }));

const { look } = await import('../../look.svelte');
const { konamiKey } = await import('../../easter-eggs/gestures');

const CODE = [
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

afterEach(async () => {
	const { setSound } = await import('../../eight-bit/eight-bit.svelte');
	setSound(true);
	sessionStorage.clear();
	look.setEightBit(false);
	for (const mock of [track, play, confetti, showToast]) mock.mockClear();
	reduced.mockReturnValue(false);
	vi.restoreAllMocks();
});

/** The module as a visit's first load would see it (vi.resetModules doesn't reach the browser). */
let loads = 0;
const fresh = (): Promise<typeof import('../../eight-bit/eight-bit.svelte')> =>
	import(/* @vite-ignore */ `../../eight-bit/eight-bit.svelte?fresh=${++loads}`);

/** The Konami code, as the keyboard or the controller sends it. */
const enterCode = () => CODE.forEach((key) => konamiKey(key));

describe('the Konami code', () => {
	it('turns 8-bit mode on, counts the find, plays the unlock jingle and says so', async () => {
		await import('../../eight-bit/eight-bit.svelte');
		enterCode();
		expect(look.eightBit).toBe(true);
		expect(track).toHaveBeenCalledWith('easter_egg_found', { egg: '8-bit' });
		expect(play).toHaveBeenCalledWith('unlock');
		expect(showToast).toHaveBeenCalledWith('↑↑↓↓←→←→BA. 8-bit mode unlocked.');
	});

	it('throws confetti in Night’s colours', async () => {
		await import('../../eight-bit/eight-bit.svelte');
		enterCode();
		await vi.waitFor(() =>
			expect(confetti).toHaveBeenCalledWith({
				vars: ['--night-red', '--night-orange', '--night-sky', '--night-green']
			})
		);
	});

	it('skips the confetti, but not the mode, with reduced motion', async () => {
		await import('../../eight-bit/eight-bit.svelte');
		reduced.mockReturnValue(true);
		enterCode();
		await new Promise((done) => setTimeout(done, 50));
		expect(look.eightBit).toBe(true);
		expect(confetti).not.toHaveBeenCalled();
	});

	it('does not count the find again when it is already on', async () => {
		await import('../../eight-bit/eight-bit.svelte');
		look.setEightBit(true);
		enterCode();
		expect(track).not.toHaveBeenCalled();
		expect(showToast).toHaveBeenCalledWith('↑↑↓↓←→←→BA. Still 8-bit.');
		expect(play).toHaveBeenCalledWith('unlock');
	});
});

describe('the sound switch', () => {
	it('plays blips while on and stays quiet once muted, for this visit', async () => {
		const { blip, setSound, sound } = await import('../../eight-bit/eight-bit.svelte');
		blip('press');
		expect(play).toHaveBeenCalledWith('press');
		setSound(false);
		expect(sound.on).toBe(false);
		expect(sessionStorage.getItem('eight-bit-sound')).toBe('off');
		play.mockClear();
		blip('press');
		expect(play).not.toHaveBeenCalled();
		setSound(true);
		expect(sessionStorage.getItem('eight-bit-sound')).toBe('on');
		blip('select');
		expect(play).toHaveBeenCalledWith('select');
	});

	it('starts muted when this visit muted it before', async () => {
		sessionStorage.setItem('eight-bit-sound', 'off');
		const { sound } = await fresh();
		expect(sound.on).toBe(false);
	});

	it('starts on by default, and when storage is blocked', async () => {
		expect((await fresh()).sound.on).toBe(true);
		vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
			throw new Error('blocked');
		});
		expect((await fresh()).sound.on).toBe(true);
	});

	it('still switches the sound for this page when storage is blocked', async () => {
		const { setSound, sound } = await import('../../eight-bit/eight-bit.svelte');
		vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
			throw new Error('blocked');
		});
		setSound(false);
		expect(sound.on).toBe(false);
	});
});

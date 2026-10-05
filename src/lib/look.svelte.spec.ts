// The look (#141) in a real browser: its first-paint script and its interface, against the real
// <html>, localStorage and sessionStorage.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const root = document.documentElement;
const systemDark = () => matchMedia('(prefers-color-scheme: dark)').matches;

function reset() {
	localStorage.clear();
	sessionStorage.clear();
	for (const name of ['data-theme', 'data-theme-pref', 'data-palette', 'data-eight-bit'])
		root.removeAttribute(name);
}

// First: the look reads <html> once, when its module first loads.
describe('look', () => {
	let look: typeof import('./look.svelte').look;
	let nextTheme: typeof import('./look.svelte').nextTheme;

	beforeAll(async () => {
		// As the first-paint script leaves it; the look reads <html> once, when it loads.
		reset();
		root.dataset.themePref = 'dark';
		root.dataset.theme = 'dark';
		root.dataset.palette = 'plum';
		root.setAttribute('data-eight-bit', '');
		({ look, nextTheme } = await import('./look.svelte'));
	});
	afterAll(reset);

	it('starts from what the page shows', () => {
		expect([look.theme, look.palette, look.paletteLabel, look.eightBit]).toEqual([
			'dark',
			'plum',
			'Plum',
			true
		]);
	});

	it('choosing a palette saves it, shows it and leaves 8-bit mode', () => {
		sessionStorage.setItem('eight-bit', '1');
		look.choosePalette('sage');
		expect(look.palette).toBe('sage');
		expect(root.dataset.palette).toBe('sage');
		expect(localStorage.getItem('palette')).toBe('sage');
		expect(look.eightBit).toBe(false);
		expect(root.hasAttribute('data-eight-bit')).toBe(false);
		expect(sessionStorage.getItem('eight-bit')).toBeNull();
	});

	it('showing a palette doesn’t choose it', () => {
		look.choosePalette('sage');
		look.showPalette('ochre');
		expect(root.dataset.palette).toBe('ochre');
		expect(look.palette).toBe('sage');
		expect(localStorage.getItem('palette')).toBe('sage');
		look.showPalette(null);
		expect(root.dataset.palette).toBe('sage');
	});

	it('8-bit mode is for this visit only', () => {
		look.setEightBit(true);
		expect(root.hasAttribute('data-eight-bit')).toBe(true);
		expect(sessionStorage.getItem('eight-bit')).toBe('1');
		expect(localStorage.getItem('eight-bit')).toBeNull();
		look.setEightBit(false);
		expect(root.hasAttribute('data-eight-bit')).toBe(false);
	});

	it('sets the theme, and shows light or dark for System from the device', () => {
		look.setTheme('light');
		expect([root.dataset.themePref, root.dataset.theme]).toEqual(['light', 'light']);
		expect(localStorage.getItem('theme')).toBe('light');
		look.setTheme('system');
		expect(root.dataset.theme).toBe(systemDark() ? 'dark' : 'light');
		expect(look.shownTheme()).toBe(root.dataset.theme);
	});

	it('the toggle cycles light → dark → system → light', () => {
		expect([nextTheme('light'), nextTheme('dark'), nextTheme('system')]).toEqual([
			'dark',
			'system',
			'light'
		]);
	});
});

describe('the first-paint script', () => {
	const boot = async (stored: { theme?: string; palette?: string; eightBit?: string }) => {
		reset();
		if (stored.theme) localStorage.setItem('theme', stored.theme);
		if (stored.palette) localStorage.setItem('palette', stored.palette);
		if (stored.eightBit) sessionStorage.setItem('eight-bit', stored.eightBit);
		const { bootScript } = await import('./look-boot');
		new Function(bootScript())();
		return {
			pref: root.dataset.themePref,
			theme: root.dataset.theme,
			palette: root.dataset.palette,
			eightBit: root.hasAttribute('data-eight-bit')
		};
	};
	afterAll(reset);

	it('applies the saved look', async () => {
		expect(await boot({ theme: 'dark', palette: 'sage', eightBit: '1' })).toEqual({
			pref: 'dark',
			theme: 'dark',
			palette: 'sage',
			eightBit: true
		});
		expect(await boot({ theme: 'light' })).toMatchObject({ pref: 'light', theme: 'light' });
	});

	it('defaults to System, Newsprint and no 8-bit mode', async () => {
		expect(await boot({})).toEqual({
			pref: 'system',
			theme: systemDark() ? 'dark' : 'light',
			palette: undefined,
			eightBit: false
		});
	});

	it('ignores values it doesn’t know', async () => {
		expect(await boot({ theme: 'sepia', palette: 'neon', eightBit: 'yes' })).toEqual({
			pref: 'system',
			theme: systemDark() ? 'dark' : 'light',
			palette: undefined,
			eightBit: false
		});
	});
});

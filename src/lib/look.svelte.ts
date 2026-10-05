// The look (#141, CONTEXT.md): the theme, the palette and 8-bit mode. The only module that reads or
// writes their storage or the <html> attributes CSS keys off (`data-theme-pref`, `data-theme`,
// `data-palette`, `data-eight-bit`). Components read `look` and call its methods; nothing else
// touches those attributes.
//
// The first-paint script that applies the saved look before anything renders is generated from
// look-boot.ts (`bootScript`, injected into app.html by the server hooks), sharing these keys.

import { KEYS } from './look-boot';
import { PALETTES, type PaletteId } from './palettes';

export const THEMES = ['light', 'dark', 'system'] as const;
export type Theme = (typeof THEMES)[number];

export { PALETTES, type PaletteId };

const isTheme = (value: unknown): value is Theme => THEMES.includes(value as Theme);
const isPalette = (value: unknown): value is PaletteId => PALETTES.some((p) => p.id === value);

/** Each press of the toggle moves to the next theme, in this order, and wraps around. */
export const nextTheme = (theme: Theme): Theme =>
	THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];

const systemDark = () => matchMedia('(prefers-color-scheme: dark)').matches;
const root = () => document.documentElement;

function store(storage: () => Storage, key: string, value: string | null) {
	try {
		if (value === null) storage().removeItem(key);
		else storage().setItem(key, value);
	} catch {
		// Private mode or storage blocked: it still applies to this page.
	}
}

class Look {
	// The server renders the defaults; in the browser the first-paint script has already applied the
	// saved look to <html>, so it's read from there once, when this module loads.
	#theme = $state<Theme>('system');
	#palette = $state<PaletteId>('newsprint');
	#eightBit = $state(false);

	constructor() {
		if (typeof document === 'undefined') return;
		const { dataset } = root();
		if (isTheme(dataset.themePref)) this.#theme = dataset.themePref;
		if (isPalette(dataset.palette)) this.#palette = dataset.palette;
		this.#eightBit = root().hasAttribute('data-eight-bit');
	}

	/** The visitor's theme: light, dark or system. */
	get theme() {
		return this.#theme;
	}

	/** The chosen palette: saved, and what 8-bit mode and the disco return to. */
	get palette() {
		return this.#palette;
	}

	get paletteLabel(): string {
		return PALETTES.find((p) => p.id === this.#palette)!.label;
	}

	get eightBit() {
		return this.#eightBit;
	}

	/** What the theme shows right now, following the device while it's System. */
	shownTheme(): 'light' | 'dark' {
		return this.#theme === 'dark' || (this.#theme === 'system' && systemDark()) ? 'dark' : 'light';
	}

	setTheme(theme: Theme) {
		this.#theme = theme;
		store(() => localStorage, KEYS.theme, theme);
		root().dataset.themePref = theme;
		root().dataset.theme = this.shownTheme();
	}

	/** Chooses and saves a palette. Choosing one leaves 8-bit mode. */
	choosePalette(id: PaletteId) {
		this.#palette = id;
		store(() => localStorage, KEYS.palette, id);
		root().dataset.palette = id;
		if (this.#eightBit) this.setEightBit(false);
	}

	/** Shows a palette for a moment without choosing it (the disco); `null` goes back to the chosen one. */
	showPalette(id: PaletteId | null) {
		root().dataset.palette = id ?? this.#palette;
	}

	setEightBit(on: boolean) {
		this.#eightBit = on;
		store(() => sessionStorage, KEYS.eightBit, on ? '1' : null);
		root().toggleAttribute('data-eight-bit', on);
	}
}

export const look = new Look();

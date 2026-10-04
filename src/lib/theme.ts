// Light / Dark / System (#80) and the colour palette (#81). The inline script in src/app.html applies
// both saved choices before the first paint (keep the two in step); ThemeToggle.svelte and
// PalettePicker.svelte change them.

export const THEMES = ['light', 'dark', 'system'] as const;
export type ThemePref = (typeof THEMES)[number];

export const STORAGE_KEY = 'theme';

/** Each press moves to the next choice, in this order, and wraps around. */
export const nextTheme = (pref: ThemePref): ThemePref =>
	THEMES[(THEMES.indexOf(pref) + 1) % THEMES.length];

export const isTheme = (value: unknown): value is ThemePref => THEMES.includes(value as ThemePref);

/** What the page shows for a choice, given whether the system is set to dark. */
export const resolveTheme = (pref: ThemePref, systemDark: boolean): 'light' | 'dark' =>
	pref === 'dark' || (pref === 'system' && systemDark) ? 'dark' : 'light';

/** Saves the choice and applies it to <html>, as the inline script does on load. */
export function setTheme(pref: ThemePref) {
	try {
		localStorage.setItem(STORAGE_KEY, pref);
	} catch {
		// Private mode or storage blocked: it still applies to this page.
	}
	const root = document.documentElement;
	root.dataset.themePref = pref;
	root.dataset.theme = resolveTheme(pref, matchMedia('(prefers-color-scheme: dark)').matches);
}

/**
 * Colour palettes (#81): a grey family and an accent hue each, defined in src/styles/palettes.css under
 * `:root[data-palette=…]`. Newsprint is the default and the brand (share cards use it). `swatch`
 * shows the palette's own accent in the picker, whatever palette the page is in.
 */
export const PALETTES = [
	{
		id: 'newsprint',
		label: 'Newsprint',
		hue: 'red',
		swatch: 'bg-(--color-red-700) dark:bg-(--color-red-400)'
	},
	{
		id: 'harbour',
		label: 'Harbour',
		hue: 'blue',
		swatch: 'bg-(--color-blue-700) dark:bg-(--color-blue-400)'
	},
	{
		id: 'sage',
		label: 'Sage',
		hue: 'green',
		swatch: 'bg-(--color-emerald-700) dark:bg-(--color-emerald-400)'
	},
	{
		id: 'plum',
		label: 'Plum',
		hue: 'violet',
		swatch: 'bg-(--color-violet-700) dark:bg-(--color-violet-400)'
	},
	{
		id: 'ochre',
		label: 'Ochre',
		hue: 'amber',
		swatch: 'bg-(--color-amber-700) dark:bg-(--color-amber-400)'
	}
] as const;
export type PaletteId = (typeof PALETTES)[number]['id'];

export const PALETTE_KEY = 'palette';

export const isPalette = (value: unknown): value is PaletteId =>
	PALETTES.some((p) => p.id === value);

/** Saves the palette and applies it to <html>, as the inline script does on load. */
export function setPalette(id: PaletteId) {
	try {
		localStorage.setItem(PALETTE_KEY, id);
	} catch {
		// Storage blocked: it still applies to this page.
	}
	document.documentElement.dataset.palette = id;
}

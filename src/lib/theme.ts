// Light / Dark / System (#80). The inline script in src/app.html applies the saved choice before the
// first paint (keep the two in step); ThemeToggle.svelte changes it.

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

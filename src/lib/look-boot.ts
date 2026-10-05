// The look's first-paint script (#141): applies the saved theme, palette and 8-bit mode to <html>
// before anything renders. The script itself is look-boot.script.js, imported as raw text so no
// bundler touches it: Svelte turns `===` into a runtime helper in .svelte.ts files, and Wrangler's
// esbuild wraps functions in `__name(…)`, and neither helper exists on a page that hasn't loaded
// anything yet. `bootScript` fills in the keys and palettes; the server hooks put it in app.html.

import { PALETTES } from './palettes';
import source from './look-boot.script.js?raw';

/** Where each choice is kept. The theme and palette last; 8-bit mode is for this visit only. */
export const KEYS = { theme: 'theme', palette: 'palette', eightBit: 'eight-bit' };

/** The first-paint script's source, for app.html: the script's text with its config filled in. */
export function bootScript(): string {
	const config = { keys: KEYS, palettes: PALETTES.map((p) => p.id) };
	return source
		.replace(/^\s*\/\/.*\n/gm, '')
		.replace(/\/\*\*[\s\S]*?\*\/\n/, '')
		.replace("/*config*/ JSON.parse('{}')", JSON.stringify(config))
		.trim();
}

// 8-bit mode on paper (#147): the mode is for the site only, so a printed page looks as if it
// were off, with no banner and the palette underneath. Real Chromium, real CSS, print emulated.

import { afterEach, describe, expect, it } from 'vitest';
import { commands } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import '../../../routes/layout.css';
import EightBitBanner from './EightBitBanner.svelte';

declare module 'vitest/browser' {
	interface BrowserCommands {
		emulateMedia: (media: 'print' | 'screen' | null) => Promise<void>;
	}
}

const root = document.documentElement;
// The colours and typeface the page renders with.
const roles = () => {
	const style = getComputedStyle(root);
	return ['--role-page', '--role-ink', '--palette-font'].map((name) =>
		style.getPropertyValue(name)
	);
};

afterEach(async () => {
	await commands.emulateMedia(null);
	root.removeAttribute('data-eight-bit');
	root.removeAttribute('data-palette');
});

describe('8-bit mode in print', () => {
	it('shows the banner on screen and hides it on paper', async () => {
		root.setAttribute('data-eight-bit', '');
		const view = render(EightBitBanner);
		const banner = view.getByRole('region', { name: '8-bit mode', includeHidden: true });

		await commands.emulateMedia('screen');
		await expect.element(banner).toBeVisible();

		await commands.emulateMedia('print');
		await expect.element(banner).not.toBeVisible();
	});

	it('prints in the palette underneath', async () => {
		root.dataset.palette = 'plum';
		await commands.emulateMedia('print');
		const plum = roles();

		root.setAttribute('data-eight-bit', '');
		expect(roles()).toEqual(plum);

		// On screen the mode does change them, so the check above isn't comparing nothing.
		await commands.emulateMedia('screen');
		expect(roles()).not.toEqual(plum);
	});
});

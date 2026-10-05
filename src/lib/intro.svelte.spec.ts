// The home intro's heading (#59, #144) in a real browser: while it's on screen the header leaves
// the name out; once it scrolls under the sticky phone bar, the header shows it.

import { afterEach, describe, expect, it } from 'vitest';
import { introHeading, watchIntro } from './intro.svelte';

afterEach(() => {
	document.body.replaceChildren();
	window.scrollTo(0, 0);
});

/** A sticky top bar like the layout's, the intro heading under it, and room to scroll. */
function page() {
	const bar = document.body.appendChild(document.createElement('header'));
	bar.setAttribute('data-top-bar', '');
	Object.assign(bar.style, { position: 'sticky', top: '0', height: '56px' });
	const heading = document.body.appendChild(document.createElement('h1'));
	heading.textContent = 'Name';
	document.body.appendChild(document.createElement('div')).style.height = '300vh';
	return heading;
}

describe('watchIntro', () => {
	it('follows the heading out from under the sticky bar and back', async () => {
		// Only the far scroll here: Vitest's iframe skews the viewport, so "under the bar but on
		// screen" is checked against the real layout instead (PR #144's browser run).
		const detach = watchIntro(page());
		window.scrollTo(0, 400);
		await expect.poll(() => introHeading.inView).toBe(false);
		window.scrollTo(0, 0);
		await expect.poll(() => introHeading.inView).toBe(true);
		detach();
	});

	it('counts the heading as on screen again once it leaves the page', async () => {
		const detach = watchIntro(page());
		window.scrollTo(0, 400);
		await expect.poll(() => introHeading.inView).toBe(false);
		detach();
		expect(introHeading.inView).toBe(true);
	});
});

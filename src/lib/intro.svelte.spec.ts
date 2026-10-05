// The home intro's heading (#59, #144) in a real browser: while it's on screen the header leaves
// the name out; once it scrolls under the sticky phone bar, the header shows it.

import { afterEach, describe, expect, it } from 'vitest';
import { intro, watchIntro } from './intro.svelte';

afterEach(() => {
	document.body.replaceChildren();
	window.scrollTo(0, 0);
});

function page() {
	const heading = document.body.appendChild(document.createElement('h1'));
	heading.textContent = 'Name';
	document.body.appendChild(document.createElement('div')).style.height = '300vh';
	return heading;
}

describe('watchIntro', () => {
	it('follows the heading out from under the sticky bar and back', async () => {
		const detach = watchIntro(page());
		await expect.poll(() => intro.inView).toBe(true);
		window.scrollTo(0, 400);
		await expect.poll(() => intro.inView).toBe(false);
		window.scrollTo(0, 0);
		await expect.poll(() => intro.inView).toBe(true);
		detach();
	});

	it('counts the heading as on screen again once it leaves the page', async () => {
		const detach = watchIntro(page());
		window.scrollTo(0, 400);
		await expect.poll(() => intro.inView).toBe(false);
		detach();
		expect(intro.inView).toBe(true);
	});
});

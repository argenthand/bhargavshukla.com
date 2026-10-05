// The palette disco's way in (#111, #143): five quick taps on the palette dot. Earlier taps open
// and close the menu as usual; the fifth starts the disco instead, but not in 8-bit mode.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';

const { disco } = vi.hoisted(() => ({ disco: vi.fn() }));
vi.mock('$lib/disco', () => ({ disco }));

const { look } = await import('$lib/look.svelte');
const { default: PalettePicker } = await import('./PalettePicker.svelte');

afterEach(() => {
	disco.mockClear();
	look.setEightBit(false);
});

function dot() {
	document.documentElement.classList.add('js'); // the dot shows only with JavaScript
	const view = render(PalettePicker);
	const button = view.container.querySelector('button')!;
	const menuOpen = () => document.getElementById('palette-menu')!.matches(':popover-open');
	const tap = (times: number) => {
		for (let i = 0; i < times; i++) button.click();
	};
	return { tap, menuOpen };
}

describe('the palette dot', () => {
	it('opens and closes the menu, then starts the disco on the fifth quick tap', async () => {
		const { tap, menuOpen } = dot();
		tap(1);
		expect(menuOpen()).toBe(true);
		tap(3);
		expect(menuOpen()).toBe(false);
		tap(1); // would reopen it
		expect(menuOpen()).toBe(false);
		await expect.poll(() => disco).toHaveBeenCalledTimes(1);
	});

	it('just opens and closes the menu in 8-bit mode', async () => {
		look.setEightBit(true);
		const { tap, menuOpen } = dot();
		tap(5);
		expect(menuOpen()).toBe(true);
		await new Promise((done) => setTimeout(done, 50));
		expect(disco).not.toHaveBeenCalled();
	});
});

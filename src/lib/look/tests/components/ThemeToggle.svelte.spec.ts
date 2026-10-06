// The theme toggle (#80): one button; each press moves to the next theme and the look saves it.

import { afterEach, describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { tick } from 'svelte';

const { look } = await import('../../look.svelte');
const { default: ThemeToggle } = await import('../../components/ThemeToggle.svelte');

afterEach(() => {
	look.setTheme('system');
	localStorage.clear();
});

describe('the theme toggle', () => {
	it('goes light → dark → system → light, saving each choice on <html> and in storage', () => {
		look.setTheme('light');
		const button = render(ThemeToggle).container.querySelector('button')!;
		const seen: string[] = [];
		for (let i = 0; i < 3; i++) {
			button.click();
			seen.push(look.theme);
			expect(document.documentElement.dataset.themePref).toBe(look.theme);
			expect(localStorage.getItem('theme')).toBe(look.theme);
		}
		expect(seen).toEqual(['dark', 'system', 'light']);
	});

	it('says which theme is on and which one a press switches to', async () => {
		look.setTheme('light');
		const button = render(ThemeToggle).container.querySelector('button')!;
		expect(button.getAttribute('aria-label')).toBe('Theme: Light. Switch to Dark');
		button.click();
		await tick();
		expect(button.getAttribute('aria-label')).toBe('Theme: Dark. Switch to System');
		button.click();
		await tick();
		expect(button.getAttribute('aria-label')).toBe('Theme: System. Switch to Light');
	});
});

// The headshot's easter egg (#63, #143): five quick clicks swap in the alternate photo and back,
// or wink when there's none.

import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ProfileHeader from '../../components/ProfileHeader.svelte';

// data: URLs, so the browser asks the test server for nothing.
const photo = (src: string) => ({ src, alt: '', width: 120, height: 120 });
const profile = (photoAlt: ReturnType<typeof photo> | null) =>
	({
		name: 'Bhargav',
		tagline: null,
		linkedin: null,
		github: null,
		photo: photo('data:,me'),
		photoAlt,
		bioHtml: '',
		bioSummary: ''
	}) as never;

function headshot(photoAlt: ReturnType<typeof photo> | null) {
	const view = render(ProfileHeader, { profile: profile(photoAlt), contacts: [] });
	const img = () => view.container.querySelector('img')!;
	const click = (times: number) => {
		for (let i = 0; i < times; i++) img().click();
	};
	return { img, click };
}

describe('the headshot', () => {
	it('swaps in the alternate photo on the fifth quick click, and back on the next five', async () => {
		const { img, click } = headshot(photo('data:,alt'));
		click(4);
		await expect.poll(() => img().getAttribute('src')).toBe('data:,me');
		click(1);
		await expect.poll(() => img().getAttribute('src')).toBe('data:,alt');
		click(5);
		await expect.poll(() => img().getAttribute('src')).toBe('data:,me');
	});

	it('winks on the fifth quick click when there is no alternate', async () => {
		const { img, click } = headshot(null);
		click(5);
		await expect.poll(() => img().className).toContain('animate-wink');
		expect(img().getAttribute('src')).toBe('data:,me');
	});
});

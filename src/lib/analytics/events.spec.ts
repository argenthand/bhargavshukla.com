// The event vocabulary spells out the palette ids itself, so analytics never imports the look
// (#161, ADR 0002). This is what keeps the two lists in step.
import { describe, expect, it } from 'vitest';
import { PALETTES } from '$lib/look/palettes';
import { PAGE_EVENTS } from './events';

describe('palette_chosen', () => {
	it('accepts exactly the look’s palettes', () => {
		expect([...PAGE_EVENTS.palette_chosen.palette]).toEqual(PALETTES.map((palette) => palette.id));
	});
});

// The palette disco's order (#111): every other palette, then back to the current one.
import { describe, expect, it } from 'vitest';
import { discoOrder } from './disco';

describe('discoOrder (#111)', () => {
	const ids = ['newsprint', 'harbour', 'sage', 'plum', 'ochre'];

	it('plays every other palette and ends on the current one', () => {
		expect(discoOrder(ids, 'sage')).toEqual(['plum', 'ochre', 'newsprint', 'harbour', 'sage']);
		expect(discoOrder(ids, 'newsprint')).toEqual(['harbour', 'sage', 'plum', 'ochre', 'newsprint']);
	});

	it('treats an unknown current palette as the first', () => {
		expect(discoOrder(ids, 'nes').at(-1)).toBe('newsprint');
	});
});

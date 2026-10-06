import { describe, expect, it } from 'vitest';
import { NOT_FOUND_LINES, notFoundLine } from '../../easter-eggs/easter-eggs';

describe('notFoundLine', () => {
	it('is stable for a path and comes from the list', () => {
		expect(notFoundLine('/old-post')).toBe(notFoundLine('/old-post'));
		expect(NOT_FOUND_LINES).toContain(notFoundLine('/old-post'));
	});

	it('varies between paths', () => {
		const lines = new Set(['/a', '/b', '/c', '/d', '/e', '/f', '/g', '/h'].map(notFoundLine));
		expect(lines.size).toBeGreaterThan(1);
	});
});

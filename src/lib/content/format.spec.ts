import { describe, expect, it } from 'vitest';
import { formatDate, formatMonth, isoDay, updatedDate, yearOf } from './format';

describe('dates', () => {
	it('formats in UTC, so a date-only displayDate never shifts a day', () => {
		expect(formatDate('2026-08-15')).toBe('August 15, 2026');
		expect(isoDay('2026-09-22T23:30:00.000Z')).toBe('2026-09-22');
		expect(yearOf('2025-12-31T23:59:00Z')).toBe(2025);
		expect(formatMonth('2026-03-01')).toBe('Mar 2026');
	});

	it('shows "Updated" only on a later calendar day', () => {
		const base = { displayDate: null, publishedAt: '2026-09-22T09:00:00Z' };
		expect(updatedDate({ ...base, updatedAt: '2026-09-22T18:00:00Z' })).toBeUndefined();
		expect(updatedDate({ ...base, updatedAt: '2026-09-27T08:00:00Z' })).toBe(
			'2026-09-27T08:00:00Z'
		);
	});
});

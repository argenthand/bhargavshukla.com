import { describe, expect, it, vi } from 'vitest';

vi.mock('$env/dynamic/private', () => ({ env: {} }));

const { asideLabel } = await import('../../server/asides');

const base = { publishedAt: '2026-10-01T09:00:00Z', sourceTitle: null, title: null, body: '' };

describe('asideLabel', () => {
	it('uses the title when there is one', () => {
		expect(asideLabel({ ...base, kind: 'tip', title: 'Own the 1:1 doc' })).toBe('Own the 1:1 doc');
	});

	it('names an untitled quote after its source', () => {
		expect(
			asideLabel({ ...base, kind: 'quote', body: 'Words.', sourceTitle: 'An Elegant Puzzle' })
		).toBe('Quote from An Elegant Puzzle');
	});

	it('uses the first words of an untitled thought, and the date for untitled code', () => {
		expect(asideLabel({ ...base, kind: 'thought', body: 'Short and **sharp**.\n\nMore.' })).toBe(
			'Short and sharp.'
		);
		expect(asideLabel({ ...base, kind: 'code', body: '```sh\nls\n```' })).toBe(
			'Code from October 1, 2026'
		);
	});
});

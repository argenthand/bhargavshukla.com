import { describe, expect, it } from 'vitest';
import { isPalette, isTheme, nextTheme, PALETTES, resolveTheme } from './theme';

describe('theme', () => {
	it('cycles light → dark → system → light', () => {
		expect(nextTheme('light')).toBe('dark');
		expect(nextTheme('dark')).toBe('system');
		expect(nextTheme('system')).toBe('light');
	});

	it('resolves System from the OS, and Light/Dark regardless of it', () => {
		expect(resolveTheme('system', true)).toBe('dark');
		expect(resolveTheme('system', false)).toBe('light');
		expect(resolveTheme('light', true)).toBe('light');
		expect(resolveTheme('dark', false)).toBe('dark');
	});

	it('accepts only known choices', () => {
		expect(isTheme('dark')).toBe(true);
		expect(isTheme('sepia')).toBe(false);
		expect(isTheme(null)).toBe(false);
	});
});

describe('palettes', () => {
	it('knows the five palettes, Newsprint first', () => {
		expect(PALETTES.map((p) => p.id)).toEqual(['newsprint', 'harbour', 'sage', 'plum', 'ochre']);
		expect(isPalette('plum')).toBe(true);
		expect(isPalette('neon')).toBe(false);
	});
});

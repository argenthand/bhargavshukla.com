import { describe, expect, it } from 'vitest';
import { creditHref, imageHost, responsive } from '../../server/images';

describe('responsive', () => {
	it('sizes Unsplash photos through imgix parameters', () => {
		const { src, srcset } = responsive('https://images.unsplash.com/photo-1?ixid=abc');
		expect(src).toBe(
			'https://images.unsplash.com/photo-1?ixid=abc&w=1280&q=80&auto=format&fit=max'
		);
		expect(srcset?.split(', ')).toHaveLength(4);
		expect(srcset).toContain('w=1920&q=80&auto=format&fit=max 1920w');
	});

	it('sizes Pexels photos, replacing an existing width', () => {
		const { src } = responsive('https://images.pexels.com/photos/1/p.jpeg?w=400');
		expect(src).toBe('https://images.pexels.com/photos/1/p.jpeg?w=1280&auto=compress&cs=tinysrgb');
	});

	it('leaves other URLs alone', () => {
		expect(responsive('https://media.bhargavshukla.com/a.jpg')).toEqual({
			src: 'https://media.bhargavshukla.com/a.jpg'
		});
		expect(imageHost('/uploads/a.jpg')).toBeUndefined();
	});
});

describe('creditHref', () => {
	it('adds Unsplash referral parameters, and nothing for other sources', () => {
		expect(creditHref('https://unsplash.com/@jane', 'unsplash')).toBe(
			'https://unsplash.com/@jane?utm_source=bhargavshukla.com&utm_medium=referral'
		);
		expect(creditHref('https://www.pexels.com/@jane', 'pexels')).toBe(
			'https://www.pexels.com/@jane'
		);
	});
});

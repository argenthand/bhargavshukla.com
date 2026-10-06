import { describe, expect, it } from 'vitest';
import { bootScript } from '../../boot/look-boot';

describe('bootScript', () => {
	it('fills in the config and drops the comments', () => {
		const script = bootScript();
		expect(script).not.toContain("JSON.parse('{}')");
		expect(script).toContain('"eightBit":"eight-bit"');
		expect(script).toContain('"palettes":["newsprint","harbour","sage","plum","ochre"]');
		expect(script).not.toMatch(/^\s*\/\//m);
	});
});

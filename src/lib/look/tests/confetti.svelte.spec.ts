// Confetti (#63, #111): canvas-confetti takes hex, so CSS colours are read through a canvas; it
// shoots from both sides until its time is up, in the palette's shades for the shown theme.

import { afterEach, describe, expect, it, vi } from 'vitest';
import '../../../routes/layout.css'; // the palettes' colours

const { canvasConfetti } = vi.hoisted(() => ({ canvasConfetti: vi.fn() }));
vi.mock('canvas-confetti', () => ({ default: canvasConfetti }));

const { confetti } = await import('../confetti');
const { look } = await import('../look.svelte');

afterEach(() => {
	canvasConfetti.mockClear();
	document.documentElement.style.removeProperty('--test-a');
	document.documentElement.style.removeProperty('--test-b');
	look.setTheme('system');
});

const colorsOf = (call: number) => canvasConfetti.mock.calls[call][0].colors as string[];

describe('confetti', () => {
	it('turns the CSS colours it is given into hex', () => {
		document.documentElement.style.setProperty('--test-a', '#ff0000');
		document.documentElement.style.setProperty('--test-b', 'rgb(0, 128, 255)');
		confetti({ vars: ['--test-a', '--test-b'], durationMs: 0 });
		expect(colorsOf(0)).toEqual(['#ff0000', '#0080ff']);
	});

	it('shoots from the left and the right, up and inward', () => {
		confetti({ vars: ['--test-a'], durationMs: 0 });
		expect(canvasConfetti).toHaveBeenCalledTimes(2);
		expect(canvasConfetti.mock.calls[0][0]).toMatchObject({
			angle: 60,
			origin: { x: 0, y: 0.8 },
			zIndex: 50
		});
		expect(canvasConfetti.mock.calls[1][0]).toMatchObject({ angle: 120, origin: { x: 1, y: 0.8 } });
	});

	it('keeps shooting every frame until its time is up, then stops', async () => {
		confetti({ vars: ['--test-a'], durationMs: 120 });
		await new Promise((done) => setTimeout(done, 250));
		const shots = canvasConfetti.mock.calls.length;
		expect(shots).toBeGreaterThan(2);
		expect(shots % 2).toBe(0);
		await new Promise((done) => setTimeout(done, 100));
		expect(canvasConfetti).toHaveBeenCalledTimes(shots);
	});

	it('uses four shades of the palette for the shown theme when no colours are given', () => {
		look.setTheme('light');
		confetti({ durationMs: 0 });
		const light = colorsOf(0);
		canvasConfetti.mockClear();
		look.setTheme('dark');
		confetti({ durationMs: 0 });
		const dark = colorsOf(0);
		expect(light).toHaveLength(4);
		expect(dark).toHaveLength(4);
		expect([...light, ...dark].every((c) => /^#[0-9a-f]{6}$/.test(c))).toBe(true);
		expect(light).not.toEqual(dark);
	});

	it('leaves no probe element behind', () => {
		const before = document.body.children.length;
		confetti({ vars: ['--test-a'], durationMs: 0 });
		expect(document.body.children.length).toBe(before);
	});
});

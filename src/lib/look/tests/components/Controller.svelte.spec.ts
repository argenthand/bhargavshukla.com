// The controller (#111): a popover with a d-pad, Select, Start, B and A. Its presses join the
// keyboard's Konami sequence (#143), echo on a strip, and the last key closes it.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { tick } from 'svelte';

const { blip, keepAwake } = vi.hoisted(() => ({ blip: vi.fn(), keepAwake: vi.fn() }));
vi.mock('../../eight-bit/eight-bit.svelte', () => ({ blip }));
vi.mock('../../eight-bit/eight-bit-sound', () => ({ keepAwake }));

const { konamiKey, onKonami } = await import('../../easter-eggs/gestures');
const { default: Controller } = await import('../../components/Controller.svelte');

const unlocked = vi.fn();
onKonami(unlocked);

const CODE = ['Up', 'Up', 'Down', 'Down', 'Left', 'Right', 'Left', 'Right', 'B', 'A'];

afterEach(() => {
	for (let i = 0; i < 10; i++) konamiKey('x'); // forget any half-entered code
	blip.mockClear();
	keepAwake.mockClear();
	unlocked.mockClear();
});

function pad() {
	const view = render(Controller);
	const root = view.container.ownerDocument.getElementById('controller')!;
	const button = (label: string) =>
		root.querySelector<HTMLElement>(`button[aria-label="${label}"]`)!;
	/** A finger: presses land on pointerdown. */
	const press = (label: string) =>
		button(label).dispatchEvent(
			new PointerEvent('pointerdown', { bubbles: true, cancelable: true })
		);
	return { root, button, press, strip: () => root.querySelector('[aria-hidden]')!.textContent };
}

describe('the controller', () => {
	it('is closed until the layout opens it, and keeps the audio awake while open', async () => {
		const { root } = pad();
		expect(root.matches(':popover-open')).toBe(false);
		(root as HTMLElement).showPopover();
		await expect.poll(() => keepAwake.mock.lastCall?.[0]).toBe(true);
		(root as HTMLElement).hidePopover();
		await expect.poll(() => keepAwake.mock.lastCall?.[0]).toBe(false);
	});

	it('completes the Konami code from the pad and closes', () => {
		const { root, press } = pad();
		root.showPopover();
		for (const label of CODE.slice(0, -1)) press(label);
		expect(unlocked).not.toHaveBeenCalled();
		expect(root.matches(':popover-open')).toBe(true);
		press('A');
		expect(unlocked).toHaveBeenCalledOnce();
		expect(root.matches(':popover-open')).toBe(false);
	});

	it('shares the code with the keyboard: half from each completes it', () => {
		const { root, press } = pad();
		root.showPopover();
		for (const key of ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown'])
			konamiKey(key.toLowerCase());
		for (const label of ['Left', 'Right', 'Left', 'Right', 'B', 'A']) press(label);
		expect(unlocked).toHaveBeenCalledOnce();
	});

	it('echoes the last ten presses on the strip, and clears it on closing', async () => {
		const { root, press, strip } = pad();
		root.showPopover();
		press('Up');
		press('Left');
		press('B');
		await tick();
		expect(strip()).toBe('↑←B');
		for (let i = 0; i < 9; i++) press('Down');
		await tick();
		expect(strip()).toBe('←B↓↓↓↓↓↓↓↓↓'.slice(-10));
		root.hidePopover();
		await expect.poll(strip).toBe('');
	});

	it('blips a press for the arrows, B and A, and a select for Select and Start', () => {
		const { root, press } = pad();
		root.showPopover();
		press('Up');
		press('B');
		expect(blip.mock.calls).toEqual([['press'], ['press']]);
		blip.mockClear();
		press('Select');
		press('Start');
		expect(blip.mock.calls).toEqual([['select'], ['select']]);
	});

	it('does not echo Select or Start on the strip', async () => {
		const { root, press, strip } = pad();
		root.showPopover();
		press('Select');
		press('Start');
		await tick();
		expect(strip()).toBe('');
	});

	it('takes a keyboard press (a click with no pointer) once, and ignores a click after a tap', async () => {
		const { root, button, strip } = pad();
		root.showPopover();
		button('Up').click(); // detail 0: Enter or Space on the button
		await tick();
		expect(strip()).toBe('↑');
		button('Up').dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 })); // the click that follows a tap
		expect(strip()).toBe('↑');
	});
});

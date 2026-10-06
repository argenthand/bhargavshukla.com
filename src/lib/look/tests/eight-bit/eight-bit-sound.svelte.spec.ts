// 8-bit mode's blips (#111): short square waves made with Web Audio on a context that wakes inside
// a tap and sleeps after a quiet spell, except while the controller is open.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

class FakeParam {
	setValueAtTime = vi.fn();
	exponentialRampToValueAtTime = vi.fn();
	value = 0;
}
class FakeNode {
	connect(next: unknown) {
		return next;
	}
}
class FakeOscillator extends FakeNode {
	type = '';
	frequency = new FakeParam();
	start = vi.fn();
	stop = vi.fn();
}
class FakeContext {
	static instances: FakeContext[] = [];
	state: 'suspended' | 'running' = 'suspended';
	currentTime = 10;
	destination = {};
	oscillators: FakeOscillator[] = [];
	resume = vi.fn(async () => {
		this.state = 'running';
	});
	suspend = vi.fn(async () => {
		this.state = 'suspended';
	});
	constructor() {
		FakeContext.instances.push(this);
	}
	createOscillator() {
		const oscillator = new FakeOscillator();
		this.oscillators.push(oscillator);
		return oscillator;
	}
	createGain() {
		return Object.assign(new FakeNode(), { gain: new FakeParam() });
	}
}

// The module keeps its audio context, so each test loads its own copy (vi.resetModules doesn't
// reach the browser).
let loads = 0;
const load = (): Promise<typeof import('../../eight-bit/eight-bit-sound')> =>
	import(/* @vite-ignore */ `../../eight-bit/eight-bit-sound?fresh=${++loads}`);

beforeEach(() => {
	FakeContext.instances = [];
	vi.stubGlobal('AudioContext', FakeContext);
	vi.useFakeTimers();
});
afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

describe('play', () => {
	it('plays each note of the sound as a square wave, on schedule', async () => {
		const { play, SOUNDS } = await load();
		play('unlock');
		const [context] = FakeContext.instances;
		expect(context.oscillators.map((o) => o.frequency.value)).toEqual(
			SOUNDS.unlock.map(([frequency]) => frequency)
		);
		expect(context.oscillators.every((o) => o.type === 'square')).toBe(true);
		SOUNDS.unlock.forEach(([, start, length], i) => {
			expect(context.oscillators[i].start).toHaveBeenCalledWith(10 + start);
			expect(context.oscillators[i].stop).toHaveBeenCalledWith(10 + start + length);
		});
	});

	it('makes one audio context and reuses it', async () => {
		const { play } = await load();
		play('press');
		play('select');
		expect(FakeContext.instances).toHaveLength(1);
	});

	it('makes no sound, and no error, where there is no Web Audio', async () => {
		vi.stubGlobal('AudioContext', undefined);
		const { play, wake, keepAwake } = await load();
		expect(() => {
			wake();
			play('press');
			keepAwake(true);
		}).not.toThrow();
		expect(FakeContext.instances).toHaveLength(0);
	});
});

describe('wake and sleep', () => {
	it('resumes a suspended context when woken from a tap', async () => {
		const { wake } = await load();
		wake();
		expect(FakeContext.instances[0].resume).toHaveBeenCalledOnce();
	});

	it('does not resume a context that is already running', async () => {
		const { wake } = await load();
		wake();
		await vi.advanceTimersByTimeAsync(0);
		wake();
		expect(FakeContext.instances[0].resume).toHaveBeenCalledOnce();
	});

	it('suspends two seconds after the last blip, and a new blip starts the wait again', async () => {
		const { play } = await load();
		play('press');
		const [context] = FakeContext.instances;
		await vi.advanceTimersByTimeAsync(1500);
		play('press');
		await vi.advanceTimersByTimeAsync(1500);
		expect(context.suspend).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(600);
		expect(context.suspend).toHaveBeenCalledOnce();
	});

	it('stays awake while the controller is open, and sleeps after it closes', async () => {
		const { keepAwake, play } = await load();
		keepAwake(true);
		play('press');
		const [context] = FakeContext.instances;
		await vi.advanceTimersByTimeAsync(10_000);
		expect(context.suspend).not.toHaveBeenCalled();
		keepAwake(false);
		await vi.advanceTimersByTimeAsync(2100);
		expect(context.suspend).toHaveBeenCalledOnce();
	});
});

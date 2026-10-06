// Turnstile's loader (#135): the script is added once, on demand, and a blocked script can be
// tried again. The script itself is never fetched here: the spec plays what it would do.

import { afterEach, describe, expect, it, vi } from 'vitest';

let loads = 0;
const fresh = (): Promise<typeof import('../turnstile')> =>
	import(/* @vite-ignore */ `../turnstile?fresh=${++loads}`); // the loader remembers its promise

/** Captures the script the loader adds, instead of letting the browser fetch it. */
function scripts() {
	const added: HTMLScriptElement[] = [];
	vi.spyOn(document.head, 'append').mockImplementation((...nodes) => {
		added.push(...(nodes as HTMLScriptElement[]));
	});
	return added;
}

afterEach(() => {
	vi.restoreAllMocks();
	delete window.turnstile;
});

describe('loadTurnstile', () => {
	it('adds Turnstile’s script, async, in explicit mode, and resolves with its API', async () => {
		const added = scripts();
		const { loadTurnstile } = await fresh();
		const loading = loadTurnstile();
		expect(added).toHaveLength(1);
		expect(added[0].src).toBe(
			'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
		);
		expect(added[0].async).toBe(true);
		const api = { render: vi.fn(), reset: vi.fn() };
		window.turnstile = api;
		added[0].onload!(new Event('load'));
		expect(await loading).toBe(api);
	});

	it('adds the script once, however many times it is asked', async () => {
		const added = scripts();
		const { loadTurnstile } = await fresh();
		const first = loadTurnstile();
		const second = loadTurnstile();
		expect(second).toBe(first);
		expect(added).toHaveLength(1);
	});

	it('rejects when the script loads but leaves no API', async () => {
		const added = scripts();
		const { loadTurnstile } = await fresh();
		const loading = loadTurnstile();
		added[0].onload!(new Event('load'));
		await expect(loading).rejects.toThrow('Turnstile: no API');
	});

	it('rejects when the script is blocked, and tries again on the next ask', async () => {
		const added = scripts();
		const { loadTurnstile } = await fresh();
		const blocked = loadTurnstile();
		added[0].onerror!(new Event('error'));
		await expect(blocked).rejects.toThrow('Turnstile: script failed to load');

		const retry = loadTurnstile();
		expect(added).toHaveLength(2);
		const api = { render: vi.fn(), reset: vi.fn() };
		window.turnstile = api;
		added[1].onload!(new Event('load'));
		expect(await retry).toBe(api);
	});
});

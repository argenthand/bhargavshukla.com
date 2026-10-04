// The contact card is on every page (#135), and without JavaScript it posts to the page it's on,
// so every page route needs the `contact` action or that visitor gets a 405.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function pages(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) return pages(path);
		return entry.name === '+page.svelte' ? [dir] : [];
	});
}

describe('contact action', () => {
	const routes = pages('src/routes');

	it('finds the page routes', () => {
		expect(routes.length).toBeGreaterThanOrEqual(6);
	});

	it.each(routes)('%s exports actions = { contact }', (dir) => {
		const server = join(dir, '+page.server.ts');
		const source = (() => {
			try {
				return readFileSync(server, 'utf8');
			} catch {
				return '';
			}
		})();
		expect(source).toMatch(/export const actions = \{ contact \}/);
	});
});

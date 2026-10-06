// The server hooks: the look's first-paint script goes into the page, and a signed preview cookie
// turns on draft preview and keeps the response from the browser and from search.

import { describe, expect, it, vi } from 'vitest';

// SvelteKit's `sequence` needs request internals that only exist inside its server, so this runs
// the hooks in order the same way: each one gets a `resolve` that calls the next.
vi.mock('@sveltejs/kit/hooks', () => ({
	sequence:
		(...handles: Array<(input: { event: unknown; resolve: unknown }) => Promise<Response>>) =>
		({
			event,
			resolve
		}: {
			event: unknown;
			resolve: (e: unknown, o?: unknown) => Promise<Response>;
		}) => {
			const run = (i: number, e: unknown, options?: object): Promise<Response> =>
				i === handles.length
					? resolve(e, options)
					: handles[i]({
							event: e,
							resolve: (next: unknown, o?: object) => run(i + 1, next, { ...options, ...o })
						});
			return run(0, event);
		}
}));
vi.mock('$env/dynamic/private', () => ({ env: { PREVIEW_SECRET: 'test-secret' } }));

const { handle } = await import('../hooks.server');
const { previewCookie, PREVIEW_COOKIE } = await import('$lib/publishing/server/preview');
const { bootScript } = await import('$lib/look');

const HTML = '<html><head><script>/*%look%*/</script></head></html>';

async function serve(cookie?: string) {
	const locals: Record<string, unknown> = {};
	const event = {
		request: new Request('https://site.test/blog'),
		url: new URL('https://site.test/blog'),
		cookies: { get: (name: string) => (name === PREVIEW_COOKIE ? cookie : undefined) },
		locals,
		isDataRequest: false
	};
	const resolve = vi.fn(
		async (
			_event: unknown,
			options?: { transformPageChunk?: (c: { html: string; done: boolean }) => unknown }
		) =>
			new Response(
				((await options?.transformPageChunk?.({ html: HTML, done: true })) as string | undefined) ??
					HTML,
				{ headers: { 'content-type': 'text/html' } }
			)
	);
	const response = await handle({ event, resolve } as never);
	return { response, locals, html: await response.text() };
}

describe('the look hook', () => {
	it("puts the look's first-paint script in the page", async () => {
		const { html } = await serve();
		expect(html).toContain(bootScript());
		expect(html).not.toContain('/*%look%*/');
	});
});

describe('the cache tags hook', () => {
	it('gives every request an empty set of tags for the loads to fill', async () => {
		const { locals } = await serve();
		expect(locals.cacheTags).toEqual(new Set());
	});
});

describe('the preview hook', () => {
	it('leaves preview off, and the response as it was, without the cookie', async () => {
		const { locals, response } = await serve();
		expect(locals.preview).toBe(false);
		expect(response.headers.get('x-robots-tag')).toBeNull();
		expect(response.headers.get('cache-control')).not.toBe('private, no-store');
	});

	it('turns preview on for a cookie we signed, and keeps the page out of caches and search', async () => {
		const { locals, response } = await serve(await previewCookie('test-secret'));
		expect(locals.preview).toBe(true);
		expect(response.headers.get('cache-control')).toBe('private, no-store');
		expect(response.headers.get('x-robots-tag')).toBe('noindex');
	});

	it('does not trust an unsigned or foreign __preview cookie', async () => {
		const { locals, response } = await serve('1');
		expect(locals.preview).toBe(false);
		expect(response.headers.get('x-robots-tag')).toBeNull();
	});
});

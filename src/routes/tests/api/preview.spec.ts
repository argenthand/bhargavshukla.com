// Draft preview (#57): the CMS's signed link turns on a signed cookie and opens the page; Exit
// drops the cookie and never sends the visitor off the site.

import { describe, expect, it, vi } from 'vitest';

vi.mock('$env/dynamic/private', () => ({ env: { PREVIEW_SECRET: 'test-secret' } }));

const enter = await import('../../api/preview/+server');
const exit = await import('../../api/preview/exit/+server');
const { COOKIE_TTL_S, PREVIEW_COOKIE, signLink, verifyCookie } =
	await import('$lib/publishing/server/preview');

/** What SvelteKit's `redirect` and `error` throw, caught so the spec can look at it. */
async function outcome(run: () => unknown) {
	try {
		await run();
	} catch (thrown) {
		return thrown as { status: number; location?: string; body?: { message: string } };
	}
	throw new Error('expected a redirect or an error');
}

function cookieJar() {
	return { set: vi.fn(), delete: vi.fn() };
}

const soon = () => Math.floor(Date.now() / 1000) + 300;

describe('GET /api/preview', () => {
	it('sets the signed cookie and redirects to the page for a valid link', async () => {
		const link = await signLink('/blog/draft', 'test-secret', soon());
		const cookies = cookieJar();
		const url = new URL(
			`https://site.test/api/preview?path=${encodeURIComponent(link.path)}&exp=${link.exp}&sig=${link.sig}`
		);
		const result = await outcome(() => enter.GET({ url, cookies } as never));
		expect(result).toMatchObject({ status: 303, location: '/blog/draft' });
		const [name, value, options] = cookies.set.mock.calls[0];
		expect(name).toBe(PREVIEW_COOKIE);
		expect(await verifyCookie(value, 'test-secret')).toBe(true);
		expect(options).toMatchObject({
			path: '/',
			httpOnly: true,
			secure: true,
			sameSite: 'lax',
			maxAge: COOKIE_TTL_S
		});
	});

	it('answers 401 and sets nothing for a link that is wrong or has run out', async () => {
		const cookies = cookieJar();
		const link = await signLink('/blog/draft', 'test-secret', soon());
		for (const query of [
			'',
			`?path=/blog/other&exp=${link.exp}&sig=${link.sig}`,
			`?path=/blog/draft&exp=${link.exp}&sig=bad`
		]) {
			const url = new URL(`https://site.test/api/preview${query}`);
			expect(await outcome(() => enter.GET({ url, cookies } as never))).toMatchObject({
				status: 401
			});
		}
		expect(cookies.set).not.toHaveBeenCalled();
	});

	it('does not mark the cookie secure on plain http (localhost)', async () => {
		const link = await signLink('/blog/draft', 'test-secret', soon());
		const cookies = cookieJar();
		const url = new URL(
			`http://localhost:5173/api/preview?path=${encodeURIComponent(link.path)}&exp=${link.exp}&sig=${link.sig}`
		);
		await outcome(() => enter.GET({ url, cookies } as never));
		expect(cookies.set.mock.calls[0][2].secure).toBe(false);
	});
});

describe('GET /api/preview/exit', () => {
	it.each([
		['/blog/draft?x=1', '/blog/draft?x=1'],
		['//evil.example', '/'],
		['https://evil.example', '/'],
		['/\\evil.example', '/']
	])('drops the cookie and goes back to %s → %s', async (path, expected) => {
		const cookies = cookieJar();
		const url = new URL(`https://site.test/api/preview/exit?path=${encodeURIComponent(path)}`);
		const result = await outcome(() => exit.GET({ url, cookies } as never));
		expect(cookies.delete).toHaveBeenCalledWith(PREVIEW_COOKIE, { path: '/' });
		expect(result).toMatchObject({ status: 303, location: expected });
	});

	it('goes home when no path is given', async () => {
		const url = new URL('https://site.test/api/preview/exit');
		expect(await outcome(() => exit.GET({ url, cookies: cookieJar() } as never))).toMatchObject({
			location: '/'
		});
	});
});

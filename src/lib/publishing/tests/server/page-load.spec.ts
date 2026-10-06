import { afterEach, describe, expect, it, vi } from 'vitest';
import { pageLoad } from '../../server/page-load';

afterEach(() => vi.restoreAllMocks());

function event(overrides: { preview?: boolean } = {}) {
	return {
		route: { id: '/blog' },
		locals: { preview: overrides.preview ?? false, degraded: false }
	};
}

describe('pageLoad', () => {
	it("returns the route's data, and a page that isn't degraded", async () => {
		const load = pageLoad(async () => ({ posts: [1, 2] }));
		expect(await load(event() as never)).toEqual({ posts: [1, 2], degraded: false });
	});

	it('shows drafts only in preview mode', async () => {
		const seen: boolean[] = [];
		const load = pageLoad(async (_event, { drafts }) => {
			seen.push(drafts);
			return {};
		});
		await load(event() as never);
		await load(event({ preview: true }) as never);
		expect(seen).toEqual([false, true]);
	});

	it('stands in the fallback for content that fails, and marks the page degraded', async () => {
		const log = vi.spyOn(console, 'error').mockImplementation(() => {});
		const e = event();
		const load = pageLoad(async (_event, { degrade }) => ({
			asides: await Promise.reject(new Error('CMS down')).catch(degrade([] as string[]))
		}));
		expect(await load(e as never)).toEqual({ asides: [], degraded: true });
		// The edge-cache hook reads only `locals`.
		expect(e.locals.degraded).toBe(true);
		expect(log).toHaveBeenCalledWith('/blog: content unavailable', expect.any(Error));
	});

	it('is not degraded while the content it can skip is there', async () => {
		const e = event();
		const load = pageLoad(async (_event, { degrade }) => ({
			asides: await Promise.resolve(['a']).catch(degrade([] as string[]))
		}));
		expect(await load(e as never)).toEqual({ asides: ['a'], degraded: false });
		expect(e.locals.degraded).toBe(false);
	});

	it("lets an error through for content the page can't do without", async () => {
		const load = pageLoad(async () => {
			throw new Error('entry missing');
		});
		await expect(load(event() as never)).rejects.toThrow('entry missing');
	});
});

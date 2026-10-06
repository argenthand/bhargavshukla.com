// The beacon's target: hands the request, preview mode and the Analytics Engine dataset to the
// analytics domain, which decides what is counted (analytics/tests/server/events.spec.ts).

import { describe, expect, it, vi } from 'vitest';

const { handleBeacon } = vi.hoisted(() => ({ handleBeacon: vi.fn() }));
vi.mock('$lib/analytics/index.server', () => ({ handleBeacon }));

const { POST } = await import('../../api/events/+server');

describe('POST /api/events', () => {
	it('passes on the request, preview mode and the dataset, and returns its answer', async () => {
		const answer = new Response(null, { status: 204 });
		handleBeacon.mockResolvedValue(answer);
		const request = new Request('https://site.test/api/events', { method: 'POST', body: '[]' });
		const dataset = { writeDataPoint: vi.fn() };
		const response = await POST({
			request,
			locals: { preview: true },
			platform: { env: { EVENTS: dataset } }
		} as never);
		expect(handleBeacon).toHaveBeenCalledWith(request, { preview: true, dataset });
		expect(response).toBe(answer);
	});

	it('passes no dataset when the Worker has none (local development)', async () => {
		handleBeacon.mockResolvedValue(new Response(null, { status: 204 }));
		const request = new Request('https://site.test/api/events', { method: 'POST' });
		await POST({ request, locals: { preview: false }, platform: undefined } as never);
		expect(handleBeacon).toHaveBeenCalledWith(request, { preview: false, dataset: undefined });
	});
});

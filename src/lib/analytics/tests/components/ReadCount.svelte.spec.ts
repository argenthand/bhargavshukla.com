// "· 1.2K reads" (#87): holds its space while the count loads and when there is none, and counts
// the read and the reading time only on the page that asks (`track`).

import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';

const { readCount, trackRead, trackReading } = vi.hoisted(() => ({
	readCount: vi.fn(),
	trackRead: vi.fn(),
	trackReading: vi.fn()
}));
vi.mock('../../reads', async (original) => ({
	...(await original<typeof import('../../reads')>()),
	readCount,
	trackRead
}));
vi.mock('../../analytics', () => ({ trackReading }));

const { default: ReadCount } = await import('../../components/ReadCount.svelte');

afterEach(() => {
	for (const mock of [readCount, trackRead, trackReading]) mock.mockReset();
});

const shown = (view: ReturnType<typeof render>) => view.container.querySelector('span')!;

describe('ReadCount', () => {
	it('shows the count once it arrives', async () => {
		readCount.mockResolvedValue(1234);
		const view = render(ReadCount, { path: '/blog/a' });
		await expect.element(view.getByText('1.2K reads')).toBeInTheDocument();
		expect(shown(view).classList.contains('invisible')).toBe(false);
		expect(readCount).toHaveBeenCalledWith('/blog/a');
	});

	it('holds its space, hidden, while the count loads and when there is none', async () => {
		readCount.mockReturnValue(new Promise(() => {}));
		const loading = render(ReadCount, { path: '/blog/a' });
		expect(shown(loading).classList.contains('invisible')).toBe(true);
		expect(shown(loading).textContent).toContain('0 reads'); // the width of the real thing

		readCount.mockResolvedValue(undefined);
		const none = render(ReadCount, { path: '/blog/b' });
		await Promise.resolve();
		expect(shown(none).classList.contains('invisible')).toBe(true);
	});

	it('counts nothing unless asked to track', () => {
		readCount.mockResolvedValue(10);
		render(ReadCount, { path: '/blog/a' });
		expect(trackRead).not.toHaveBeenCalled();
		expect(trackReading).not.toHaveBeenCalled();
	});

	it('tracks the read and the reading time when asked, and stops on leaving the page', () => {
		readCount.mockResolvedValue(10);
		const stopRead = vi.fn();
		const stopReading = vi.fn();
		trackRead.mockReturnValue(stopRead);
		trackReading.mockReturnValue(stopReading);
		const view = render(ReadCount, { path: '/blog/a', track: true });
		expect(trackRead).toHaveBeenCalledWith('/blog/a');
		expect(trackReading).toHaveBeenCalledWith('/blog/a');
		expect(stopRead).not.toHaveBeenCalled();
		view.unmount();
		expect(stopRead).toHaveBeenCalledOnce();
		expect(stopReading).toHaveBeenCalledOnce();
	});

	it('asks for the new page’s count when the path changes, and drops the old answer', async () => {
		let answerOld!: (n: number) => void;
		readCount.mockImplementationOnce(() => new Promise((resolve) => (answerOld = resolve)));
		const view = render(ReadCount, { path: '/blog/old' });
		readCount.mockResolvedValueOnce(2000);
		await view.rerender({ path: '/blog/new' });
		await expect.element(view.getByText('2K reads')).toBeInTheDocument();
		answerOld(99_000); // late: must not replace the new page's count
		await Promise.resolve();
		expect(view.container.textContent).toContain('2K reads');
		expect(view.container.textContent).not.toContain('99K');
	});
});

// The one-line message at the bottom of the screen.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { showToast, toast, TOAST_MS } from '../toast.svelte';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
	vi.useRealTimers();
	toast.message = '';
});

describe('showToast', () => {
	it('shows the message, then clears it after three seconds', () => {
		showToast('Hello');
		expect(toast.message).toBe('Hello');
		vi.advanceTimersByTime(TOAST_MS - 1);
		expect(toast.message).toBe('Hello');
		vi.advanceTimersByTime(1);
		expect(toast.message).toBe('');
	});

	it('lets a new message replace the old one and start its own clock', () => {
		showToast('First');
		vi.advanceTimersByTime(2000);
		showToast('Second');
		vi.advanceTimersByTime(2000); // the first one's clock would have run out by now
		expect(toast.message).toBe('Second');
		vi.advanceTimersByTime(1000);
		expect(toast.message).toBe('');
	});

	it('stays as long as it is asked to', () => {
		showToast('Long', 10_000);
		vi.advanceTimersByTime(9999);
		expect(toast.message).toBe('Long');
		vi.advanceTimersByTime(1);
		expect(toast.message).toBe('');
	});
});

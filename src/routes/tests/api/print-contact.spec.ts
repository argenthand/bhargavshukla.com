// The printed resume's email (#135): encoded so the address isn't in the response as text, and
// null, not an error, when the CMS can't be reached.

import { afterEach, describe, expect, it, vi } from 'vitest';

const { getContactEmail } = vi.hoisted(() => ({ getContactEmail: vi.fn() }));
vi.mock('$lib/content/index.server', () => ({ getContactEmail }));

const { GET } = await import('../../api/print-contact/+server');
const { decodeContact } = await import('$lib/contact');

afterEach(() => vi.restoreAllMocks());

const ask = () => GET({ locals: {} } as never);

describe('GET /api/print-contact', () => {
	it('returns the address encoded, kept five minutes and out of search', async () => {
		getContactEmail.mockResolvedValue('hello@example.com');
		const response = await ask();
		const { e } = await response.json();
		expect(e).not.toContain('hello@example.com');
		expect(decodeContact(e)).toBe('hello@example.com');
		expect(response.headers.get('cache-control')).toBe('public, max-age=300');
		expect(response.headers.get('x-robots-tag')).toBe('noindex');
	});

	it('returns null while no address is saved', async () => {
		getContactEmail.mockResolvedValue(null);
		expect(await (await ask()).json()).toEqual({ e: null });
	});

	it('returns null, not kept, when the CMS fails', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		getContactEmail.mockRejectedValue(new Error('CMS down'));
		const response = await ask();
		expect(await response.json()).toEqual({ e: null });
		expect(response.headers.get('cache-control')).toBe('no-store');
	});
});

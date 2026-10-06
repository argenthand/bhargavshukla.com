// The contact card (#135) in a real browser: checks on leaving a field and on every keystroke after
// an error, Send that stays focusable but jumps to the first problem, the background post with its
// Turnstile token, the results, and the page you get back without JavaScript. SvelteKit's `enhance`
// is replaced by a stand-in that hands the spec the card's submit function.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { tick } from 'svelte';

type Submit = (input: { formData: FormData; cancel: () => void }) => Promise<unknown>;
type WidgetOptions = { callback: (token: string) => void };
type After = (input: { result: unknown }) => Promise<unknown> | unknown;

const { track, optedOut, loadTurnstile, enhanced, page } = vi.hoisted(() => ({
	track: vi.fn(),
	optedOut: vi.fn(() => false),
	loadTurnstile: vi.fn(),
	enhanced: { submit: undefined as unknown as Submit },
	page: { form: null as unknown, url: { pathname: '/blog' } }
}));

vi.mock('$app/environment', () => ({ dev: false }));
vi.mock('$app/forms', () => ({
	enhance: (_form: HTMLFormElement, submit: Submit) => {
		enhanced.submit = submit;
		return { destroy() {} };
	}
}));
vi.mock('$app/state', async (original) => ({
	...(await original<typeof import('$app/state')>()),
	page
}));
vi.mock('$env/dynamic/public', () => ({ env: { PUBLIC_TURNSTILE_SITE_KEY: 'site-key' } }));
vi.mock('$lib/analytics', async (original) => ({
	...(await original<typeof import('$lib/analytics')>()),
	track,
	optedOut
}));
vi.mock('../../turnstile', async (original) => ({
	...(await original<typeof import('../../turnstile')>()),
	loadTurnstile
}));

const { default: ContactCard } = await import('../../components/ContactCard.svelte');

const GOOD = { from: 'ada@example.com', subject: 'Hello', message: 'A message.' };

/** A Turnstile that has rendered once, and can give a token. */
function turnstile() {
	const api = {
		render: vi.fn<(container: HTMLElement, options: WidgetOptions) => string>(() => 'widget-1'),
		reset: vi.fn()
	};
	loadTurnstile.mockResolvedValue(api);
	const options = () => api.render.mock.calls[0][1];
	return { api, options };
}

beforeEach(() => {
	page.form = null;
	loadTurnstile.mockReset();
	turnstile();
});
afterEach(() => {
	track.mockClear();
	optedOut.mockReturnValue(false);
	vi.restoreAllMocks();
});

async function card() {
	const view = render(ContactCard);
	await tick(); // onMount: the scripted checks take over
	const q = <T extends HTMLElement>(selector: string) => view.container.querySelector<T>(selector)!;
	const field = (name: 'from' | 'subject' | 'message') =>
		q<HTMLInputElement | HTMLTextAreaElement>(`[name=${name}]`);
	const type = async (name: 'from' | 'subject' | 'message', value: string) => {
		const el = field(name);
		el.value = value;
		el.dispatchEvent(new Event('input', { bubbles: true }));
		await tick();
	};
	const leave = async (name: 'from' | 'subject' | 'message') => {
		field(name).dispatchEvent(new FocusEvent('blur'));
		await tick();
	};
	const fillAll = async (values = GOOD) => {
		for (const [name, value] of Object.entries(values)) await type(name as 'from', value);
	};
	const send = q<HTMLButtonElement>('button[type=submit]');
	const text = () => view.container.textContent ?? '';
	return { view, q, field, type, leave, fillAll, send, text };
}

/** Presses Send: what `enhance` would do, with the form's data. */
async function submit(formData = new FormData()) {
	const cancel = vi.fn();
	const after = (await enhanced.submit({ formData, cancel })) as After | undefined;
	return { cancel, after, formData };
}

describe('checking a field', () => {
	it('checks a field when it is left, but leaves an empty one for Send', async () => {
		const { type, leave, text } = await card();
		await leave('from');
		expect(text()).not.toContain('Enter your email address.');
		await type('from', 'not an email');
		await leave('from');
		expect(text()).toContain('Enter an email address I can reply to.');
	});

	it('re-checks on every keystroke once there is an error, so it clears when fixed', async () => {
		const { type, leave, text, field } = await card();
		await type('from', 'ada@');
		await leave('from');
		expect(field('from').getAttribute('aria-invalid')).toBe('true');
		await type('from', 'ada@example.com');
		expect(text()).not.toContain('Enter an email address I can reply to.');
		expect(field('from').getAttribute('aria-invalid')).toBeNull();
	});

	it('counts the message and flags it past 1,000 characters', async () => {
		const { type, text, q } = await card();
		await type('message', 'Hello');
		expect(text()).toContain('5 / 1,000');
		await type('message', 'x'.repeat(1001));
		expect(text()).toContain('1,001 / 1,000');
		expect(text()).toContain('Keep it to 1,000 characters.');
		expect(q('#contact-count').className).toContain('text-danger');
	});

	it('counts the first keystroke of a message once', async () => {
		const { type } = await card();
		await type('subject', 'H');
		await type('subject', 'He');
		expect(track.mock.calls.filter(([name]) => name === 'contact_started')).toHaveLength(1);
	});
});

describe('Send', () => {
	it('looks inactive while anything is missing, but stays focusable', async () => {
		const { send, type, fillAll } = await card();
		expect(send.getAttribute('aria-disabled')).toBe('true');
		expect(send.disabled).toBe(false);
		await type('from', GOOD.from);
		expect(send.getAttribute('aria-disabled')).toBe('true');
		await fillAll();
		expect(send.getAttribute('aria-disabled')).toBeNull();
	});

	it('does not post an incomplete card: it shows every problem and focuses the first', async () => {
		const { type, text, field } = await card();
		await type('subject', GOOD.subject);
		const { cancel, after } = await submit();
		await tick();
		expect(cancel).toHaveBeenCalledOnce();
		expect(after).toBeUndefined();
		expect(text()).toContain('Enter your email address.');
		expect(text()).toContain('Write a message.');
		expect(document.activeElement).toBe(field('from'));
	});

	it('posts a complete card and shows Sending… until the answer', async () => {
		const { fillAll, send } = await card();
		await fillAll();
		const { cancel, after } = await submit();
		await tick();
		expect(cancel).not.toHaveBeenCalled();
		expect(send.textContent?.trim()).toBe('Sending…');
		expect(send.getAttribute('aria-disabled')).toBe('true');
		await after!({ result: { type: 'success' } });
		await tick();
	});

	it('ignores a second press while sending', async () => {
		const { fillAll } = await card();
		await fillAll();
		await submit();
		const second = await submit();
		expect(second.cancel).toHaveBeenCalledOnce();
	});

	it('marks the post as the author’s on the author’s devices', async () => {
		const { fillAll } = await card();
		await fillAll();
		optedOut.mockReturnValue(true);
		const { formData } = await submit();
		expect(formData.get('no-count')).toBe('1');
	});

	it('does not mark it otherwise', async () => {
		const { fillAll } = await card();
		await fillAll();
		const { formData } = await submit();
		expect(formData.has('no-count')).toBe(false);
	});
});

describe('Turnstile', () => {
	it('starts on the first focus, once, with the site key and the quiet settings', async () => {
		const { api } = turnstile();
		const { field } = await card();
		field('from').dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
		field('subject').dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
		await vi.waitFor(() => expect(api.render).toHaveBeenCalledOnce());
		expect(loadTurnstile).toHaveBeenCalledOnce();
		expect(api.render.mock.calls[0][1]).toMatchObject({
			sitekey: 'site-key',
			appearance: 'interaction-only',
			'refresh-expired': 'auto'
		});
	});

	it('sends the token it has, and resets the widget after the send', async () => {
		const { api, options } = turnstile();
		const { field, fillAll } = await card();
		await fillAll();
		field('from').dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
		await vi.waitFor(() => expect(api.render).toHaveBeenCalled());
		options().callback('token-1');
		const { formData, after } = await submit();
		expect(formData.get('cf-turnstile-response')).toBe('token-1');
		await after!({ result: { type: 'success' } });
		expect(api.reset).toHaveBeenCalledWith('widget-1'); // a token works once
	});

	it('waits for a token on its way, then sends it', async () => {
		const { api, options } = turnstile();
		const { field, fillAll } = await card();
		await fillAll();
		field('from').dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
		await vi.waitFor(() => expect(api.render).toHaveBeenCalled());
		const pending = submit();
		options().callback('late-token');
		expect((await pending).formData.get('cf-turnstile-response')).toBe('late-token');
	});

	it('sends without a token when the script is blocked', async () => {
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		loadTurnstile.mockRejectedValue(new Error('blocked'));
		const { field, fillAll } = await card();
		await fillAll();
		field('from').dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
		await vi.waitFor(() => expect(loadTurnstile).toHaveBeenCalled());
		const { formData } = await submit();
		expect(formData.has('cf-turnstile-response')).toBe(false);
	});
});

describe('the answer', () => {
	async function sent(result: unknown) {
		const c = await card();
		await c.fillAll();
		const { after } = await submit();
		await after!({ result });
		await tick();
		return c;
	}

	it('thanks the sender by their address, and clears the card for the next message', async () => {
		const { text } = await sent({ type: 'success' });
		expect(text()).toContain('Message sent');
		expect(text()).toContain(GOOD.from);
	});

	it('shows the server’s checks under the fields and focuses the first', async () => {
		const { text, field } = await sent({
			type: 'failure',
			data: {
				contact: {
					status: 'invalid',
					values: GOOD,
					errors: { subject: 'Add a subject.' }
				}
			}
		});
		expect(text()).toContain('Add a subject.');
		expect(document.activeElement).toBe(field('subject'));
	});

	it('shows a failed send’s message and keeps what was typed', async () => {
		const { text, field } = await sent({
			type: 'failure',
			data: { contact: { status: 'failed', values: GOOD, errors: {}, error: 'Mail is down.' } }
		});
		expect(text()).toContain('Mail is down.');
		expect(field('message').value).toBe(GOOD.message);
	});

	it.each([
		['an error', { type: 'error' }],
		['a failure with nothing in it', { type: 'failure', data: undefined }]
	])('says it couldn’t send, and keeps the message, for %s', async (_, result) => {
		const { text, field } = await sent(result);
		expect(text()).toContain("Couldn't send just now.");
		expect(field('message').value).toBe(GOOD.message);
	});

	it('goes back to an empty card on “Send another”', async () => {
		const { q, text, field } = await sent({ type: 'success' });
		q<HTMLAnchorElement>('a[href$="#contact"]').click();
		await tick();
		expect(text()).toContain('Send me a message');
		expect(field('message').value).toBe('');
	});
});

describe('without JavaScript', () => {
	it('shows the thanks when the page comes back with a sent message', () => {
		page.form = { contact: { status: 'sent', from: GOOD.from } };
		const view = render(ContactCard);
		expect(view.container.textContent).toContain('Message sent');
		expect(view.container.textContent).toContain(GOOD.from);
	});

	it('keeps what was typed and shows the errors when the page comes back with a problem', () => {
		page.form = {
			contact: {
				status: 'invalid',
				values: { ...GOOD, from: 'nope' },
				errors: { from: 'Enter an email address I can reply to.' }
			}
		};
		const view = render(ContactCard);
		expect(view.container.querySelector<HTMLInputElement>('[name=from]')!.value).toBe('nope');
		expect(view.container.textContent).toContain('Enter an email address I can reply to.');
	});

	it('shows a failed send’s message and keeps the text', () => {
		page.form = {
			contact: { status: 'failed', values: GOOD, errors: {}, error: 'Mail is down.' }
		};
		const view = render(ContactCard);
		expect(view.container.textContent).toContain('Mail is down.');
		expect(view.container.querySelector<HTMLTextAreaElement>('[name=message]')!.value).toBe(
			GOOD.message
		);
	});
});

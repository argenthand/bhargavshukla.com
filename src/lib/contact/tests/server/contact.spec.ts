import { readFileSync } from 'node:fs';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { describe, expect, it, vi } from 'vitest';

vi.mock('$app/environment', () => ({ dev: false }));
vi.mock('$env/dynamic/private', () => ({ env: {} }));

const { countSend, DAILY_CAP, handleContact, mailFor, MESSAGES, sendWithResend, verifyTurnstile } =
	await import('../../server/contact');
type Deps = import('../../server/contact').ContactDeps;

function form(fields: Record<string, string>): FormData {
	const data = new FormData();
	for (const [name, value] of Object.entries(fields)) data.set(name, value);
	return data;
}

const valid = { from: 'sam@example.com', subject: 'Hello', message: 'A note.' };

function deps(overrides: Partial<Deps> = {}) {
	const counts: Record<string, number> = {};
	const sent: unknown[] = [];
	const outcomes: string[] = [];
	const fakes: Deps = {
		allow: async () => true,
		verify: async () => true,
		count: async (kind) => (counts[kind] = (counts[kind] ?? 0) + 1),
		send: async (mail) => void sent.push(mail),
		log: (outcome) => void outcomes.push(outcome),
		...overrides
	};
	return { fakes, sent, outcomes, counts };
}

describe('handleContact', () => {
	it('sends a verified message', async () => {
		const { fakes, sent, outcomes } = deps();
		const result = await handleContact(form({ ...valid, 'cf-turnstile-response': 'ok' }), fakes);
		expect(result).toEqual({ contact: { status: 'sent', from: 'sam@example.com' } });
		expect(sent).toEqual([mailFor(valid, true)]);
		expect(outcomes).toEqual(['sent']);
	});

	it('sends without a token, marked unverified', async () => {
		const { fakes, sent, outcomes } = deps();
		await handleContact(form(valid), fakes);
		expect(sent).toEqual([expect.objectContaining({ subject: '[unverified] Hello' })]);
		expect(outcomes).toEqual(['sent-unverified']);
	});

	it('tells a bot that filled the honeypot it worked, and sends nothing', async () => {
		const { fakes, sent, outcomes } = deps();
		const result = await handleContact(form({ ...valid, company: 'Acme' }), fakes);
		expect(result).toEqual({ contact: { status: 'sent', from: 'sam@example.com' } });
		expect(sent).toEqual([]);
		expect(outcomes).toEqual(['honeypot']);
	});

	it('returns the errors and what was typed', async () => {
		const { fakes, sent } = deps();
		const result = await handleContact(form({ ...valid, from: 'sam@' }), fakes);
		expect(result).toMatchObject({
			status: 400,
			data: {
				contact: {
					status: 'invalid',
					values: { ...valid, from: 'sam@' },
					errors: { from: 'Enter an email address I can reply to.' }
				}
			}
		});
		expect(sent).toEqual([]);
	});

	it('stops a visitor over the rate limit', async () => {
		const { fakes, sent } = deps({ allow: async () => false });
		const result = await handleContact(form(valid), fakes);
		expect(result).toMatchObject({ status: 429, data: { contact: { error: MESSAGES.rate } } });
		expect(sent).toEqual([]);
	});

	it('rejects a token Turnstile turns down', async () => {
		const { fakes, sent } = deps({ verify: async () => false });
		const result = await handleContact(form({ ...valid, 'cf-turnstile-response': 'bad' }), fakes);
		expect(result).toMatchObject({ status: 400, data: { contact: { error: MESSAGES.turnstile } } });
		expect(sent).toEqual([]);
	});

	it('caps unverified sends a day, but not verified ones', async () => {
		const { fakes, sent } = deps();
		for (let i = 0; i < DAILY_CAP.unverified; i++) await handleContact(form(valid), fakes);
		const capped = await handleContact(form(valid), fakes);
		expect(capped).toMatchObject({ status: 429, data: { contact: { error: MESSAGES.cap } } });
		await handleContact(form({ ...valid, 'cf-turnstile-response': 'ok' }), fakes);
		expect(sent).toHaveLength(DAILY_CAP.unverified + 1);
	});

	it('caps all sends a day', async () => {
		const { fakes } = deps({ count: async () => DAILY_CAP.all + 1 });
		const result = await handleContact(form({ ...valid, 'cf-turnstile-response': 'ok' }), fakes);
		expect(result).toMatchObject({ status: 429 });
	});

	it('keeps the message when sending fails', async () => {
		const { fakes, outcomes } = deps({
			send: async () => {
				throw new Error('down');
			}
		});
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const result = await handleContact(form(valid), fakes);
		expect(result).toMatchObject({
			status: 502,
			data: { contact: { status: 'failed', values: valid, error: MESSAGES.send } }
		});
		expect(outcomes).toEqual(['send-failed']);
	});
});

describe('countSend', () => {
	it('counts per day and kind, and forgets earlier days', async () => {
		const sqlite = new DatabaseSync(':memory:');
		sqlite.exec(readFileSync('migrations/0002_contact.sql', 'utf8'));
		const prepare = (sql: string) => {
			let values: SQLInputValue[] = [];
			const statement = {
				bind: (...args: unknown[]) => ((values = args as SQLInputValue[]), statement),
				run: async () => ({
					meta: { changes: Number(sqlite.prepare(sql).run(...values).changes) }
				}),
				first: async <T>() => (sqlite.prepare(sql).get(...values) as T | undefined) ?? null,
				all: async <T>() => ({ results: sqlite.prepare(sql).all(...values) as T[] })
			};
			return statement;
		};
		const db = { prepare, batch: async () => [] };
		expect(await countSend(db, 'all', '2026-10-03')).toBe(1);
		expect(await countSend(db, 'all', '2026-10-04')).toBe(1);
		expect(await countSend(db, 'all', '2026-10-04')).toBe(2);
		expect(await countSend(db, 'unverified', '2026-10-04')).toBe(1);
		expect(
			sqlite.prepare('SELECT COUNT(*) AS n FROM contact_sends WHERE day < ?').get('2026-10-04')
		).toEqual({ n: 0 });
	});
});

describe('verifyTurnstile', () => {
	it('posts the token, secret and IP, and reads success', async () => {
		const fetcher = vi.fn(async (_url: string, init?: RequestInit) => {
			const body = init?.body as FormData;
			expect([body.get('secret'), body.get('response'), body.get('remoteip')]).toEqual([
				's',
				't',
				'1.2.3.4'
			]);
			return Response.json({ success: true });
		});
		expect(await verifyTurnstile('t', 's', '1.2.3.4', fetcher as unknown as typeof fetch)).toBe(
			true
		);
	});

	it('fails closed', async () => {
		const fetcher = async () => new Response('', { status: 500 });
		expect(await verifyTurnstile('t', 's', '', fetcher as unknown as typeof fetch)).toBe(false);
	});
});

describe('sendWithResend', () => {
	it('sends to the inbox with the visitor as Reply-To', async () => {
		let sentBody: Record<string, unknown> = {};
		const fetcher = async (_url: string, init?: RequestInit) => {
			sentBody = JSON.parse(String(init?.body));
			return Response.json({ id: '1' });
		};
		await sendWithResend(
			mailFor(valid, true),
			{ apiKey: 'k', from: 'Site <form@x.test>', to: 'inbox@x.test' },
			fetcher as unknown as typeof fetch
		);
		expect(sentBody).toMatchObject({
			from: 'Site <form@x.test>',
			to: ['inbox@x.test'],
			reply_to: 'sam@example.com',
			subject: 'Hello'
		});
	});

	it('throws when Resend refuses', async () => {
		const fetcher = async () => new Response('nope', { status: 422 });
		await expect(
			sendWithResend(
				mailFor(valid, true),
				{ apiKey: 'k', from: 'f', to: 't' },
				fetcher as unknown as typeof fetch
			)
		).rejects.toThrow('Resend 422');
	});
});

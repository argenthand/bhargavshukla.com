// The contact card's form action (#135, docs/contact.md). Every page route exports it as
// `actions = { contact }`: the card sits in the layout, and layouts can't have actions. With
// JavaScript the card posts in the background; without it, the browser posts to the page it's on
// and gets that page back, scrolled to the card, with the result.
//
// Spam: a honeypot field, a per-IP rate limit, and Cloudflare Turnstile. Turnstile needs
// JavaScript, so a send without a token (a visitor without JavaScript, or a bot) is accepted only
// under a small daily cap and arrives marked [unverified].

import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import { fail, type Action, type ActionFailure } from '@sveltejs/kit';
import {
	checkContact,
	contactValues,
	HONEYPOT,
	type ContactResult,
	type ContactValues
} from '$lib/contact';
import type { ReadsDb } from './reads';
import { getContactEmail } from './profile';

/** Sends a day without a Turnstile token (no JavaScript, or a bot), and in all. */
export const DAILY_CAP = { unverified: 10, all: 50 };

/** Turnstile's documented test secret: every token passes. Only used under `vite dev`. */
const TEST_SECRET = '1x0000000000000000000000000000000AA';

export const MESSAGES = {
	rate: 'Too many messages from here. Try again in a minute.',
	turnstile: "The spam check didn't pass. Reload the page and try again.",
	cap: 'The form has had a busy day. Try again tomorrow, or find me on LinkedIn.',
	send: "Couldn't send: the mail service didn't answer. Your message is still here; try again in a minute."
};

/** What a send ended as, logged for Workers Logs (and the analytics in #136). */
export type ContactOutcome =
	| 'sent'
	| 'sent-unverified'
	| 'invalid'
	| 'honeypot'
	| 'rate-limited'
	| 'turnstile-failed'
	| 'capped'
	| 'send-failed';

export interface ContactDeps {
	/** True while this visitor (by IP) may send; false once they hit the limit. */
	allow(): Promise<boolean>;
	/** Checks a Turnstile token with Cloudflare. */
	verify(token: string): Promise<boolean>;
	/** Counts one more send of this kind today and returns the new count. */
	count(kind: keyof typeof DAILY_CAP): Promise<number>;
	/** Delivers the message; throws if it can't. */
	send(message: Mail): Promise<void>;
	log(outcome: ContactOutcome): void;
}

export interface Mail {
	replyTo: string;
	subject: string;
	text: string;
}

type Failure = ActionFailure<{ contact: ContactResult }>;

function failed(status: number, values: ContactValues, error: string): Failure {
	return fail(status, { contact: { status: 'failed', values, errors: {}, error } });
}

/** The action's work, with everything outside the Worker passed in (tests use fakes). */
export async function handleContact(
	data: FormData,
	deps: ContactDeps
): Promise<{ contact: ContactResult } | Failure> {
	const values = contactValues(data);

	// A bot that filled the hidden field is told it worked, so it has no reason to try again.
	if (String(data.get(HONEYPOT) ?? '')) {
		deps.log('honeypot');
		return { contact: { status: 'sent', from: values.from } };
	}

	const errors = checkContact(values);
	if (Object.keys(errors).length > 0) {
		deps.log('invalid');
		return fail(400, { contact: { status: 'invalid', values, errors } });
	}

	if (!(await deps.allow())) {
		deps.log('rate-limited');
		return failed(429, values, MESSAGES.rate);
	}

	const token = String(data.get('cf-turnstile-response') ?? '');
	if (token && !(await deps.verify(token))) {
		deps.log('turnstile-failed');
		return failed(400, values, MESSAGES.turnstile);
	}
	const verified = Boolean(token);

	if (!verified && (await deps.count('unverified')) > DAILY_CAP.unverified) {
		deps.log('capped');
		return failed(429, values, MESSAGES.cap);
	}
	if ((await deps.count('all')) > DAILY_CAP.all) {
		deps.log('capped');
		return failed(429, values, MESSAGES.cap);
	}

	try {
		await deps.send(mailFor(values, verified));
	} catch (err) {
		console.error('Contact: send failed', err);
		deps.log('send-failed');
		return failed(502, values, MESSAGES.send);
	}
	deps.log(verified ? 'sent' : 'sent-unverified');
	return { contact: { status: 'sent', from: values.from } };
}

export function mailFor(values: ContactValues, verified: boolean): Mail {
	return {
		replyTo: values.from,
		subject: `${verified ? '' : '[unverified] '}${values.subject}`,
		text: `${values.message}\n\n— ${values.from}, via the contact form on bhargavshukla.com`
	};
}

/** Today's count of one kind of send, in D1; days before today are deleted as it goes. */
export async function countSend(db: ReadsDb, kind: string, day: string): Promise<number> {
	await db.prepare('DELETE FROM contact_sends WHERE day < ?').bind(day).run();
	const row = await db
		.prepare(
			`INSERT INTO contact_sends (day, kind, count) VALUES (?, ?, 1)
			 ON CONFLICT (day, kind) DO UPDATE SET count = count + 1 RETURNING count`
		)
		.bind(day, kind)
		.first<{ count: number }>();
	return row?.count ?? 1;
}

export async function verifyTurnstile(
	token: string,
	secret: string,
	ip: string,
	fetcher: typeof fetch
): Promise<boolean> {
	const body = new FormData();
	body.set('secret', secret);
	body.set('response', token);
	if (ip) body.set('remoteip', ip);
	const response = await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
		method: 'POST',
		body
	});
	if (!response.ok) return false;
	return ((await response.json()) as { success?: boolean }).success === true;
}

export async function sendWithResend(
	mail: Mail,
	{ apiKey, from, to }: { apiKey: string; from: string; to: string },
	fetcher: typeof fetch
): Promise<void> {
	const response = await fetcher('https://api.resend.com/emails', {
		method: 'POST',
		headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
		body: JSON.stringify({
			from,
			to: [to],
			reply_to: mail.replyTo,
			subject: mail.subject,
			text: mail.text
		})
	});
	if (!response.ok) throw new Error(`Resend ${response.status}: ${await response.text()}`);
}

export const contact: Action = async (event) => {
	const { platform, locals, fetch } = event;
	const ip = event.getClientAddress();
	const db = platform?.env.READS;
	const limiter = platform?.env.CONTACT_RATE;
	const day = new Date().toISOString().slice(0, 10);
	const secret = env.TURNSTILE_SECRET || (dev ? TEST_SECRET : '');

	return handleContact(await event.request.formData(), {
		allow: async () => (limiter ? (await limiter.limit({ key: ip })).success : true),
		verify: (token) =>
			secret ? verifyTurnstile(token, secret, ip, fetch) : Promise.resolve(false),
		// Without D1, or with D1 failing, nothing is counted, so nothing is capped: better a few
		// extra emails than a form that can't send.
		count: async (kind) => {
			if (!db) return 0;
			try {
				return await countSend(db, kind, day);
			} catch (err) {
				console.error('Contact: count failed', err);
				return 0;
			}
		},
		send: async (mail) => {
			if (dev && !env.RESEND_API_KEY) {
				console.info('Contact (dev, not sent):', mail);
				return;
			}
			const to = await getContactEmail(locals);
			if (!env.RESEND_API_KEY || !env.CONTACT_FROM || !to)
				throw new Error('Contact: RESEND_API_KEY, CONTACT_FROM or the profile email is missing');
			await sendWithResend(mail, { apiKey: env.RESEND_API_KEY, from: env.CONTACT_FROM, to }, fetch);
		},
		log: (outcome) => console.log(JSON.stringify({ contact: outcome }))
	});
};

// The contact card (#135, CONTACT-* on the canvas): its fields and their rules, shared by the
// browser (live checks) and the server (the `contact` form action), so both say the same thing.

export const CONTACT_FIELDS = ['from', 'subject', 'message'] as const;
export type ContactField = (typeof CONTACT_FIELDS)[number];
export type ContactValues = Record<ContactField, string>;
export type ContactErrors = Partial<Record<ContactField, string>>;

/** Most characters each field takes. An email address can't be longer than 254. */
export const CONTACT_MAX: Record<ContactField, number> = { from: 254, subject: 150, message: 1000 };

/** Hidden from people; a bot that fills every field fills this too (#135). */
export const HONEYPOT = 'company';

/** Where the action is posted: the page it's on, scrolled back to the card. */
export const CONTACT_ACTION = '?/contact#contact';

/** The result the action hands back to the card, as `form.contact`. */
export type ContactResult =
	| { status: 'sent'; from: string }
	| { status: 'invalid' | 'failed'; values: ContactValues; errors: ContactErrors; error?: string };

// Deliberately loose: something@something.tld. The reply is the real test.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@.]+$/;

export function contactValues(data: FormData): ContactValues {
	const get = (name: string) => String(data.get(name) ?? '').trim();
	return { from: get('from'), subject: get('subject'), message: get('message') };
}

/** One message per field that's wrong, worded for the field it sits under. */
export function checkField(field: ContactField, value: string): string | undefined {
	const length = [...value].length;
	if (field === 'from') {
		if (!value) return 'Enter your email address.';
		if (length > CONTACT_MAX.from || !EMAIL.test(value))
			return 'Enter an email address I can reply to.';
	}
	if (field === 'subject') {
		if (!value) return 'Add a subject.';
		if (length > CONTACT_MAX.subject) return 'Keep the subject to 150 characters.';
	}
	if (field === 'message') {
		if (!value) return 'Write a message.';
		if (length > CONTACT_MAX.message) return 'Keep it to 1,000 characters.';
	}
}

export function checkContact(values: ContactValues): ContactErrors {
	const errors: ContactErrors = {};
	for (const field of CONTACT_FIELDS) {
		const error = checkField(field, values[field]);
		if (error) errors[field] = error;
	}
	return errors;
}

/** The printed resume's email in transit (#135): reversed, then base64. Not secret, just not plain. */
export const encodeContact = (email: string) => btoa([...email].reverse().join(''));
export const decodeContact = (encoded: string) => [...atob(encoded)].reverse().join('');

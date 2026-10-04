import { describe, expect, it } from 'vitest';
import { checkContact, checkField, contactValues, decodeContact, encodeContact } from './contact';

describe('checkField', () => {
	it('wants a reply address', () => {
		expect(checkField('from', '')).toBe('Enter your email address.');
		expect(checkField('from', 'sam@example')).toBe('Enter an email address I can reply to.');
		expect(checkField('from', 'sam example@x.com')).toBe('Enter an email address I can reply to.');
		expect(checkField('from', 'sam@example.com')).toBeUndefined();
	});

	it('limits the subject to 150 characters and the message to 1,000', () => {
		expect(checkField('subject', 'a'.repeat(150))).toBeUndefined();
		expect(checkField('subject', 'a'.repeat(151))).toBe('Keep the subject to 150 characters.');
		expect(checkField('message', 'a'.repeat(1000))).toBeUndefined();
		expect(checkField('message', 'a'.repeat(1001))).toBe('Keep it to 1,000 characters.');
	});

	it('counts characters, not UTF-16 units, like the counter', () => {
		expect(checkField('message', '👋'.repeat(1000))).toBeUndefined();
	});
});

describe('checkContact', () => {
	it('names every empty field', () => {
		expect(Object.keys(checkContact({ from: '', subject: '', message: '' }))).toEqual([
			'from',
			'subject',
			'message'
		]);
	});
});

describe('contactValues', () => {
	it('trims what was posted', () => {
		const data = new FormData();
		data.set('from', ' sam@example.com ');
		data.set('subject', ' Hi ');
		expect(contactValues(data)).toEqual({ from: 'sam@example.com', subject: 'Hi', message: '' });
	});
});

describe('encodeContact', () => {
	it('round-trips without the address in plain sight', () => {
		const encoded = encodeContact('someone@example.com');
		expect(encoded).not.toContain('@');
		expect(atob(encoded)).not.toContain('someone');
		expect(decodeContact(encoded)).toBe('someone@example.com');
	});
});

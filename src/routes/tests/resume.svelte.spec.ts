// The resume page: on screen inside the site, and on paper as a one-column Letter that reads
// cleanly in applicant tracking systems. Real Chromium and real CSS, with print emulated.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { commands } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import '../layout.css';

declare module 'vitest/browser' {
	interface BrowserCommands {
		emulateMedia: (media: 'print' | 'screen' | null) => Promise<void>;
	}
}

const { track } = vi.hoisted(() => ({ track: vi.fn() }));
// The contact card (reached through $lib/contact) reads its Turnstile key from here.
vi.mock('$env/dynamic/public', () => ({ env: {} }));
vi.mock('$lib/analytics', async (original) => ({
	...(await original<typeof import('$lib/analytics')>()),
	track
}));

const { default: Resume } = await import('../resume/+page.svelte');
const { look } = await import('$lib/look');
const { encodeContact } = await import('$lib/contact');

const profile = {
	name: 'Bhargav',
	tagline: 'Engineering leader',
	linkedin: 'https://www.linkedin.com/in/bhargav/',
	github: null,
	photo: null,
	photoAlt: null,
	bioHtml: '',
	bioSummary: ''
};
const role = (over = {}) => ({
	role: 'Engineering Manager',
	location: null,
	startDate: '2022-01-01',
	endDate: null,
	bullets: ['Led a team of <strong>nine</strong>', 'Cut deploy time'],
	highlightsHtml: '',
	...over
});
const resume = {
	location: 'Toronto, Canada',
	summary: 'Leader of engineers.',
	updatedAt: '2026-09-01T00:00:00.000Z',
	employers: [
		{
			company: 'Acme',
			location: 'Toronto',
			startDate: '2020-01-01',
			endDate: null,
			roles: [
				role(),
				role({
					role: 'Senior Engineer',
					startDate: '2020-01-01',
					endDate: '2022-01-01',
					bullets: ['Built things']
				})
			]
		}
	],
	skillGroups: [{ label: 'Languages', skills: 'TypeScript, Go' }],
	education: [{ credential: 'BSc', school: 'University', year: '2012' }],
	certifications: [{ name: 'Cert', issuer: 'Body', year: '2020' }]
};

/** What /api/print-contact answers, once `answer` is called. */
function printContact(email: string | null = 'ada@example.com') {
	let answer!: () => void;
	const fetch = vi.fn(
		() =>
			new Promise((resolve) => {
				answer = () => resolve({ json: async () => ({ e: email && encodeContact(email) }) });
			})
	);
	vi.stubGlobal('fetch', fetch);
	return { fetch, answer: () => answer() };
}

beforeEach(() => document.documentElement.classList.add('js'));
afterEach(async () => {
	await commands.emulateMedia(null);
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
	vi.useRealTimers();
	track.mockClear();
	look.choosePalette('newsprint');
});

function page(data: Record<string, unknown> = {}) {
	const view = render(Resume, { data: { resume, profile, degraded: false, ...data } as never });
	const text = () => (view.container.textContent ?? '').replace(/\s+/g, ' ');
	const saveButton = () =>
		[...view.container.querySelectorAll('button')].find((b) =>
			b.textContent?.includes('Save as PDF')
		)!;
	return { view, text, saveButton };
}

describe('on screen', () => {
	it('shows each section, with a company heading over each role and its bullets', async () => {
		printContact(null);
		const { text, view } = page();
		for (const heading of ['Summary', 'Experience', 'Skills', 'Education', 'Certifications'])
			expect(text()).toContain(heading);
		expect(text()).toContain('Leader of engineers.');
		expect(
			[...view.container.querySelectorAll('h3')].map((h) =>
				h.textContent?.trim().split('·')[0].trim()
			)
		).toEqual(['Acme']);
		expect([...view.container.querySelectorAll('h4')].map((h) => h.textContent?.trim())).toEqual([
			'Engineering Manager',
			'Senior Engineer'
		]);
		expect(view.container.querySelectorAll('article li')).toHaveLength(3);
		expect(view.container.querySelector('article li strong')!.textContent).toBe('nine');
		expect(text()).toContain('Jan 2022 - Present');
		expect(text()).toContain('Jan 2020 - Jan 2022');
		expect(text()).toContain('TypeScript, Go');
		expect(text()).toContain('BSc');
		expect(text()).toContain('Cert · Body');
	});

	it('says when it was last updated, and offers Save as PDF', async () => {
		printContact(null);
		const { text, saveButton } = page();
		expect(text()).toContain('Last updated');
		expect(text()).toContain('Sep 2026');
		await expect.element(saveButton()).toBeVisible();
	});

	it('leaves out a section the author has not filled in', () => {
		printContact(null);
		const { text } = page({
			resume: { ...resume, skillGroups: [], certifications: [], employers: [] }
		});
		expect(text()).not.toContain('Skills');
		expect(text()).not.toContain('Certifications');
		expect(text()).not.toContain('Experience');
		expect(text()).toContain('Education');
	});

	it('says the resume is on its way until one is published, with nothing to print', () => {
		printContact(null);
		const { text, saveButton } = page({ resume: undefined });
		expect(text()).toContain('The full resume is on its way.');
		expect(saveButton()).toBeUndefined();
	});

	it('says it can’t load when the CMS is down', () => {
		printContact(null);
		expect(page({ resume: undefined, degraded: true }).text()).toContain(
			"The resume can't load right now."
		);
	});
});

describe('on paper', () => {
	it('hides what is for the screen: the update line, Save as PDF and the role dots', async () => {
		printContact(null);
		const { view, saveButton } = page();
		const updated = view.getByText('Last updated');
		await commands.emulateMedia('screen');
		await expect.element(updated).toBeVisible();
		await commands.emulateMedia('print');
		await expect.element(updated).not.toBeVisible();
		await expect.element(saveButton()).not.toBeVisible();
		const dot = view.container.querySelector('article span[aria-hidden]')!;
		expect(getComputedStyle(dot).display).toBe('none');
	});

	it('prints the company’s location beside its name, not under it', async () => {
		printContact(null);
		const { view } = page();
		const [beside, under] = ['h3 span.hidden', 'div.mt-0\\.5.meta'].map((selector) =>
			view.container.querySelector(selector)!
		);
		await commands.emulateMedia('screen');
		expect(getComputedStyle(beside).display).toBe('none');
		expect(getComputedStyle(under).display).not.toBe('none');
		await commands.emulateMedia('print');
		expect(getComputedStyle(beside).display).not.toBe('none');
		expect(getComputedStyle(under).display).toBe('none');
	});

	it('lays the page out as one block in black on paper, with no width cap', async () => {
		printContact(null);
		const { view } = page();
		const sheet = view.container.querySelector<HTMLElement>('.print-sheet')!;
		await commands.emulateMedia('screen');
		expect(getComputedStyle(sheet).display).toBe('flex');
		await commands.emulateMedia('print');
		expect(getComputedStyle(sheet).display).toBe('block');
		expect(getComputedStyle(sheet).maxWidth).toBe('none');
		expect(getComputedStyle(view.container.querySelector('h2')!).color).toBe('rgb(0, 0, 0)');
	});

	it('shows the printed note only on paper, in the chosen palette', async () => {
		look.choosePalette('plum');
		printContact(null);
		const { view } = page();
		const note = view.container.querySelector<HTMLImageElement>('img[src^="/print-notes/"]')!;
		await expect.poll(() => note.getAttribute('src')).toBe('/print-notes/plum.svg');
		await commands.emulateMedia('screen');
		expect(getComputedStyle(note).display).toBe('none');
		await commands.emulateMedia('print');
		expect(getComputedStyle(note).display).not.toBe('none');
	});

	it('prints the email once it has loaded, in place of Send a message', async () => {
		const contact = printContact('ada@example.com');
		const { text } = page();
		expect(text()).not.toContain('ada@example.com');
		contact.answer();
		await vi.waitFor(() => expect(text()).toContain('ada@example.com'));
		expect(contact.fetch).toHaveBeenCalledWith('/api/print-contact');
	});

	it('goes without the email when it is not saved or the request fails', async () => {
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
		const { text } = page();
		await new Promise((done) => setTimeout(done, 20));
		expect(text()).not.toContain('@');
	});
});

describe('Save as PDF', () => {
	it('prints straight away when the email is already here', async () => {
		const print = vi.spyOn(window, 'print').mockImplementation(() => {});
		const contact = printContact();
		const { text, saveButton } = page();
		contact.answer();
		await vi.waitFor(() => expect(text()).toContain('ada@example.com'));
		saveButton().click();
		expect(print).toHaveBeenCalledOnce();
	});

	it('waits for the email on its way, then prints with it', async () => {
		const print = vi.spyOn(window, 'print').mockImplementation(() => {});
		const contact = printContact();
		const { text, saveButton } = page();
		saveButton().click();
		await new Promise((done) => setTimeout(done, 30));
		expect(print).not.toHaveBeenCalled();
		contact.answer();
		await vi.waitFor(() => expect(print).toHaveBeenCalledOnce());
		expect(text()).toContain('ada@example.com');
	});

	it('prints without the email after two seconds', async () => {
		const print = vi.spyOn(window, 'print').mockImplementation(() => {});
		printContact(); // never answers
		const { saveButton } = page();
		vi.useFakeTimers();
		saveButton().click();
		await vi.advanceTimersByTimeAsync(1999);
		expect(print).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(1);
		expect(print).toHaveBeenCalledOnce();
	});

	it('counts a print or a saved PDF, whichever starts it', () => {
		printContact(null);
		page();
		window.dispatchEvent(new Event('beforeprint'));
		expect(track).toHaveBeenCalledWith('resume_printed');
	});
});

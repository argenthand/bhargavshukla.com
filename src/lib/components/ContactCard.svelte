<script lang="ts">
	// CONTACT-* (#135, docs/contact.md): the card above the footer on every page. From, Subject and
	// a Message of up to 1,000 characters, sent by the `contact` form action.
	//
	// With JavaScript: a field is checked when it's left, then on every keystroke until it's fixed;
	// Send looks inactive while anything is missing or wrong but stays focusable, and pressing it
	// jumps to the first problem. The post goes in the background, with a Turnstile token.
	// Without JavaScript: the browser checks the basics, posts to the page it's on, and gets that
	// page back at the card with the result (`page.form`).
	import { dev } from '$app/environment';
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { env } from '$env/dynamic/public';
	import { onMount, tick } from 'svelte';
	import {
		checkContact,
		checkField,
		CONTACT_ACTION,
		CONTACT_MAX,
		HONEYPOT,
		type ContactErrors,
		type ContactField,
		type ContactResult,
		type ContactValues
	} from '$lib/contact';
	import { loadTurnstile, TEST_SITE_KEY, type Turnstile } from '$lib/turnstile';
	import Icon from './Icon.svelte';

	const SEND_FAILED = "Couldn't send just now. Your message is still here; try again in a minute.";
	const EMPTY: ContactValues = { from: '', subject: '', message: '' };
	const siteKey = env.PUBLIC_TURNSTILE_SITE_KEY || (dev ? TEST_SITE_KEY : '');

	// A post without JavaScript comes back as this page with the action's result.
	const posted = (page.form as { contact?: ContactResult } | null)?.contact;
	const kept = posted && posted.status !== 'sent' ? posted : undefined;

	let values = $state<ContactValues>(kept ? { ...kept.values } : { ...EMPTY });
	let errors = $state<ContactErrors>(kept ? { ...kept.errors } : {});
	let failure = $state(kept?.error ?? '');
	let sentTo = $state(posted?.status === 'sent' ? posted.from : '');
	let sending = $state(false);
	let hydrated = $state(false);
	let form = $state<HTMLFormElement>();

	const trimmed = $derived({
		from: values.from.trim(),
		subject: values.subject.trim(),
		message: values.message.trim()
	});
	const complete = $derived(Object.keys(checkContact(trimmed)).length === 0);
	const count = $derived([...trimmed.message].length);

	// Server-rendered, the form is the plain one; these switch to the scripted checks.
	onMount(() => (hydrated = true));

	/** Leaving a field checks it, unless it was left empty: that waits for Send. */
	function onBlur(field: ContactField) {
		if (trimmed[field] || errors[field]) errors[field] = checkField(field, trimmed[field]);
	}

	/** Once a field has an error, every keystroke re-checks it, so the error clears when it's fixed. */
	function onInput(field: ContactField) {
		const tooLong = [...trimmed[field]].length > CONTACT_MAX[field];
		if (errors[field] || tooLong) errors[field] = checkField(field, trimmed[field]);
	}

	async function focusFirstError() {
		await tick();
		form?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
	}

	// Turnstile: started on the first focus, its token kept for Send.
	let turnstile: Turnstile | undefined;
	let widget = $state<HTMLDivElement>();
	let widgetId: string | undefined;
	let token = '';
	let waiting: ((token: string) => void)[] = [];

	async function startSpamCheck() {
		if (turnstile || !siteKey || !widget) return;
		try {
			turnstile = await loadTurnstile();
			widgetId = turnstile.render(widget!, {
				sitekey: siteKey,
				appearance: 'interaction-only',
				theme: 'auto',
				'response-field': false,
				'refresh-expired': 'auto',
				callback: (fresh) => {
					token = fresh;
					for (const resolve of waiting.splice(0)) resolve(fresh);
				},
				'expired-callback': () => (token = ''),
				'error-callback': () => (token = '')
			});
		} catch (err) {
			// Blocked (an ad blocker, a network filter): the send goes without a token, as unverified.
			turnstile = undefined;
			console.warn(err);
		}
	}

	/** The token, waiting a little for one that's on its way. Empty if none comes. */
	function tokenFor(ms: number): Promise<string> {
		if (token || !widgetId) return Promise.resolve(token);
		return new Promise((resolve) => {
			waiting.push(resolve);
			setTimeout(() => resolve(token), ms);
		});
	}

	function sendAnother(event: MouseEvent) {
		event.preventDefault();
		sentTo = '';
		values = { ...EMPTY };
		errors = {};
		failure = '';
		// The form is drawn again, so Turnstile's widget is too, on the next focus.
		turnstile = undefined;
		widgetId = undefined;
	}
</script>

{#snippet error(field: ContactField)}
	{#if errors[field]}
		<p id="contact-{field}-error" class="flex items-center gap-1.5 text-danger">
			<Icon name="alert" size={14} class="shrink-0" />{errors[field]}
		</p>
	{/if}
{/snippet}

<section
	id="contact"
	aria-labelledby="contact-title"
	class="flex scroll-mt-24 flex-col gap-5 surface p-5 md:p-7 print:hidden"
>
	{#if sentTo}
		<div role="status" class="flex flex-col gap-3">
			<h2 id="contact-title" class="flex items-center gap-2.5 text-2xl font-medium text-ink">
				<Icon name="check" size={20} class="text-accent" />Message sent
			</h2>
			<p class="text-lg text-body">
				Thanks. I'll reply to <strong class="font-semibold text-ink">{sentTo}</strong>, usually
				within a few days.
			</p>
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- this page, at the card -->
			<a href="{page.url.pathname}#contact" onclick={sendAnother} class="link-cta self-start">
				Send another
			</a>
		</div>
	{:else}
		<div class="flex flex-col gap-1.5">
			<h2 id="contact-title" class="text-2xl font-medium tracking-tight text-ink">
				Send me a message
			</h2>
			<p class="text-lg text-muted">
				It goes straight to my inbox. I'll reply to the address you give.
			</p>
		</div>

		<form
			bind:this={form}
			method="POST"
			action={CONTACT_ACTION}
			novalidate={hydrated}
			onfocusin={startSpamCheck}
			class="flex flex-col gap-5"
			use:enhance={async ({ formData, cancel }) => {
				if (sending) return cancel();
				if (!complete) {
					cancel();
					errors = checkContact(trimmed);
					return focusFirstError();
				}
				sending = true;
				failure = '';
				const fresh = await tokenFor(4000);
				if (fresh) formData.set('cf-turnstile-response', fresh);
				return async ({ result }) => {
					sending = false;
					// A token works once.
					if (turnstile && widgetId) turnstile.reset(widgetId);
					token = '';
					if (result.type === 'success') {
						sentTo = trimmed.from;
						values = { ...EMPTY };
						errors = {};
						return;
					}
					const contact =
						result.type === 'failure'
							? (result.data as { contact?: ContactResult } | undefined)?.contact
							: undefined;
					if (contact && contact.status !== 'sent') {
						errors = { ...contact.errors };
						failure = contact.error ?? '';
						if (contact.status === 'invalid') return focusFirstError();
					} else failure = SEND_FAILED;
				};
			}}
		>
			<div class="flex flex-col gap-2">
				<label for="contact-from" class="label-muted">From</label>
				<div class="field">
					<input
						id="contact-from"
						name="from"
						type="email"
						autocomplete="email"
						required
						maxlength={CONTACT_MAX.from}
						placeholder="you@example.com"
						bind:value={values.from}
						onblur={() => onBlur('from')}
						oninput={() => onInput('from')}
						aria-invalid={errors.from ? 'true' : undefined}
						aria-describedby={errors.from ? 'contact-from-error' : undefined}
						class="h-11 min-w-0 flex-1 border-0 bg-transparent p-0 text-lg placeholder:text-faint focus:ring-0 focus:outline-none"
					/>
				</div>
				{@render error('from')}
			</div>

			<div class="flex flex-col gap-2">
				<label for="contact-subject" class="label-muted">Subject</label>
				<div class="field">
					<input
						id="contact-subject"
						name="subject"
						type="text"
						required
						maxlength={hydrated ? undefined : CONTACT_MAX.subject}
						placeholder="What's it about?"
						bind:value={values.subject}
						onblur={() => onBlur('subject')}
						oninput={() => onInput('subject')}
						aria-invalid={errors.subject ? 'true' : undefined}
						aria-describedby={errors.subject ? 'contact-subject-error' : undefined}
						class="h-11 min-w-0 flex-1 border-0 bg-transparent p-0 text-lg placeholder:text-faint focus:ring-0 focus:outline-none"
					/>
				</div>
				{@render error('subject')}
			</div>

			<div class="flex flex-col gap-2">
				<div class="flex items-baseline justify-between gap-3">
					<label for="contact-message" class="label-muted">Message</label>
					<span
						id="contact-count"
						class={[
							'text-sm tabular-nums',
							count > CONTACT_MAX.message ? 'text-danger' : 'text-faint'
						]}
					>
						{count.toLocaleString('en')} / {CONTACT_MAX.message.toLocaleString('en')}
					</span>
				</div>
				<div class="field-area">
					<!-- Without JavaScript the browser stops at 1,000; with it, longer text stays and is flagged. -->
					<textarea
						id="contact-message"
						name="message"
						required
						rows="5"
						maxlength={hydrated ? undefined : CONTACT_MAX.message}
						placeholder="What's on your mind?"
						bind:value={values.message}
						onblur={() => onBlur('message')}
						oninput={() => onInput('message')}
						aria-invalid={errors.message ? 'true' : undefined}
						aria-describedby={errors.message
							? 'contact-message-error contact-count'
							: 'contact-count'}
						class="min-h-32 w-full flex-1 resize-y border-0 bg-transparent p-0 text-lg placeholder:text-faint focus:ring-0 focus:outline-none"
					></textarea>
				</div>
				{@render error('message')}
			</div>

			<!-- For bots: hidden from people and screen readers; filling it in sends nothing. -->
			<div class="sr-only" aria-hidden="true">
				<label>Company <input name={HONEYPOT} tabindex="-1" autocomplete="off" /></label>
			</div>

			<!-- Turnstile's checkbox, only if it ever needs one. -->
			<div bind:this={widget} class="empty:hidden"></div>

			{#if failure}
				<p role="alert" class="flex gap-2 text-danger">
					<Icon name="alert" class="mt-1 shrink-0" />{failure}
				</p>
			{/if}

			<div class="flex flex-wrap items-center gap-x-4 gap-y-3">
				<button
					type="submit"
					data-nes-cta
					aria-disabled={hydrated && (!complete || sending) ? 'true' : undefined}
					class="inline-flex min-h-11 items-center gap-2 rounded-full bg-accent px-6 text-lg font-medium text-page hover:bg-accent-hover aria-disabled:opacity-40 aria-disabled:hover:bg-accent"
				>
					{sending ? 'Sending…' : 'Send'}
				</button>
				<p class="hidden meta js:block">Spam check by Cloudflare Turnstile.</p>
			</div>
		</form>
	{/if}
</section>

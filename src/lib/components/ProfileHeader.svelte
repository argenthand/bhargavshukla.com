<script lang="ts" module>
	import type { IconName } from './Icon.svelte';

	export type Contact = {
		href: string;
		text: string;
		icon: IconName;
		external?: boolean;
		/** Left off paper: "Send a message" means nothing there. */
		screenOnly?: boolean;
	};

	/** Link text without the scheme: "linkedin.com/in/…". It prints as-is, so it doubles as the URL. */
	const bare = (url: string) => url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/+$/, '');

	/**
	 * "Send a message" (the contact card, #135: the email is never on the page), the site (when
	 * given: the resume lists it, home is it), LinkedIn, GitHub; only those set.
	 */
	export function profileContacts(
		profile: { linkedin: string | null; github: string | null } | undefined,
		{ website }: { website?: string } = {}
	): Contact[] {
		return [
			{ href: '#contact', text: 'Send a message', icon: 'mail', screenOnly: true },
			website && { href: website, text: bare(website), icon: 'globe' },
			profile?.linkedin && {
				href: profile.linkedin,
				text: bare(profile.linkedin),
				icon: 'linkedin',
				external: true
			},
			profile?.github && {
				href: profile.github,
				text: bare(profile.github),
				icon: 'github',
				external: true
			}
		].filter(Boolean) as Contact[];
	}
</script>

<script lang="ts">
	// PH-* (#99): one header for the home intro and the resume. Headshot, name and tagline, then the
	// contacts one per line beside them from md (#96); on phones the contacts wrap under the name.
	// In print: no photo (no photos on North American resumes, and ATS parsers skip images).
	import type { getProfile } from '$lib/server/profile';
	import { site } from '$lib/site';
	import Icon from './Icon.svelte';

	type Props = {
		profile: Awaited<ReturnType<typeof getProfile>>;
		contacts: Contact[];
		/** The home intro's heading id: the layout fades the header name in once it scrolls away (#59). */
		headingId?: string;
		/** Printed after the contacts, e.g. the resume's location. */
		printNote?: string | null;
		/** Printed first, in place of "Send a message": the resume's email (#135), fetched after load. */
		printEmail?: string | null;
	};
	let { profile, contacts, headingId, printNote, printEmail }: Props = $props();

	// The headshot's easter egg (#63): five quick clicks swap in the profile's alternate photo (and
	// back); without one, the photo winks instead (not with reduced motion).
	const CLICKS = 5;
	const CLICK_WINDOW_MS = 2000;
	let clicks: number[] = [];
	let showAlt = $state(false);
	let winking = $state(false);
	const shownPhoto = $derived((showAlt && profile?.photoAlt) || profile?.photo);

	function onPhotoClick() {
		const now = Date.now();
		clicks = [...clicks.filter((t) => now - t < CLICK_WINDOW_MS), now];
		if (clicks.length < CLICKS) return;
		clicks = [];
		if (profile?.photoAlt) showAlt = !showAlt;
		else winking = true;
	}
</script>

<header
	class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between md:gap-8 print:flex-row print:items-start print:justify-between print:gap-8"
>
	<div class="flex min-w-0 items-center gap-4 md:gap-5">
		{#if shownPhoto}
			<!-- A mouse-only easter egg: no button, so it adds no tab stop or announcement for anyone. -->
			<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
			<img
				src={shownPhoto.src}
				srcset={shownPhoto.srcset}
				sizes="(min-width: 768px) 120px, 112px"
				alt={shownPhoto.alt}
				width={shownPhoto.width}
				height={shownPhoto.height}
				decoding="async"
				onclick={onPhotoClick}
				onanimationend={() => (winking = false)}
				class={[
					'size-28 shrink-0 rounded-full bg-fill object-cover select-none md:size-30 print:hidden',
					winking && 'motion-safe:animate-wink'
				]}
			/>
		{/if}
		<div class="min-w-0">
			<h1 id={headingId} class="page-title print:text-2xl">
				{profile?.name ?? site.name}
			</h1>
			{#if profile?.tagline}
				<p class="mt-2 standfirst print:mt-1 print:text-base print:text-black">{profile.tagline}</p>
			{/if}
		</div>
	</div>
	{#if contacts.length > 0 || printNote || printEmail}
		<ul
			class="flex flex-wrap gap-x-4 text-sm md:shrink-0 md:flex-col print:flex-col print:gap-y-0.5"
		>
			{#if printEmail}
				<li class="hidden print:block">
					<a href="mailto:{printEmail}" class="text-accent-print">{printEmail}</a>
				</li>
			{/if}
			{#each contacts as contact (contact.href)}
				<li class={contact.screenOnly ? 'print:hidden' : undefined}>
					<!-- eslint-disable svelte/no-navigation-without-resolve -- #contact, the site's origin and external profiles -->
					<a
						href={contact.href}
						target={contact.external ? '_blank' : undefined}
						rel={contact.external ? 'noopener noreferrer' : undefined}
						class="tap-target gap-1.5 text-accent hover:text-accent-hover print:min-h-0 print:text-accent-print"
					>
						<Icon name={contact.icon} size={14} class="print:hidden" />{contact.text}
						{#if contact.external}<span class="sr-only"> (opens in a new tab)</span>{/if}
					</a>
					<!-- eslint-enable svelte/no-navigation-without-resolve -->
				</li>
			{/each}
			{#if printNote}
				<li class="hidden print:block">{printNote}</li>
			{/if}
		</ul>
	{/if}
</header>

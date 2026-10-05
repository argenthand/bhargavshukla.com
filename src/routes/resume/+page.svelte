<script lang="ts">
	// RRC-* (#94, Promotion path): on screen inside the site chrome, and a one-column Letter print
	// ("Save as PDF") that reads cleanly in applicant tracking systems: standard headings, no icons.
	// Content comes from the Strapi Resume; the header is the shared ProfileHeader (#99) from the Profile.
	import { page } from '$app/state';
	import { tick } from 'svelte';
	import Icon from '$lib/components/Icon.svelte';
	import ProfileHeader, { profileContacts } from '$lib/components/ProfileHeader.svelte';
	import { decodeContact } from '$lib/contact';
	import Seo from '$lib/components/Seo.svelte';
	import { formatMonth } from '$lib/format';
	import { site } from '$lib/site';
	import { isPalette, type PaletteId } from '$lib/theme';
	import type { Employer, Role } from '$lib/server/resume';

	let { data } = $props();

	const resume = $derived(data.resume);
	const profile = $derived(data.profile);

	const contacts = $derived(profileContacts(profile, { website: page.url.origin }));

	// The email, on paper only (#135): never in the page or its data, so it's fetched after load.
	// Save as PDF waits for it; the browser's own Print gets it once it's here.
	let printEmail = $state<string | null>(null);
	let emailReady: Promise<void> | undefined;
	let emailLoaded = false;
	$effect(() => {
		emailReady = fetch('/api/print-contact')
			.then((response) => response.json() as Promise<{ e: string | null }>)
			.then(({ e }) => {
				if (e) printEmail = decodeContact(e);
			})
			.catch((err) => console.warn('Print contact unavailable', err))
			.finally(() => (emailLoaded = true));
	});

	async function savePdf() {
		// Print straight from the tap when the email is already here (the usual case); otherwise wait
		// up to 2 s for it, then print with or without it.
		if (!emailLoaded) {
			await Promise.race([emailReady, new Promise((resolve) => setTimeout(resolve, 2000))]);
			await tick();
		}
		window.print();
	}

	// The printed note (#102) in the current palette. Only that palette's image loads; it follows
	// the palette picker. Without JavaScript the page is in Newsprint, the default.
	let palette = $state<PaletteId>('newsprint');
	$effect(() => {
		const root = document.documentElement;
		const read = () => {
			const current = root.dataset.palette;
			palette = isPalette(current) ? current : 'newsprint';
		};
		read();
		const observer = new MutationObserver(read);
		observer.observe(root, { attributes: true, attributeFilter: ['data-palette'] });
		return () => observer.disconnect();
	});

	// No browser headers or footers on paper (#129): Chrome only prints its own (date, title, URL,
	// page numbers) when the page margin has room. So the margin moves onto the resume, repeated on
	// every printed page by `clone`; the values are the @page margin in src/styles/document.css. Safari can't
	// repeat it, and Firefox draws its headers at the paper's edge whatever the margin (on Android
	// it also ignores the @page margin, so the padding added a page): both keep that margin.
	// Inline, because the CSS build widens this @supports test to the -webkit- property, which
	// Safari has. `!important`: this comes before document.css's @page, and Chrome lets the later
	// rule win even over a named page.
	const printSheet = `<style>@supports (box-decoration-break: clone) and (not (-moz-appearance: none)) {
	@page resume { margin: 0 !important }
	@media print { .print-sheet { page: resume; padding: 0.6in 0.75in; box-decoration-break: clone } }
}</style>`;

	/** "Apr 2021 – Present". */
	const dates = (start: string, end: string | null) =>
		`${formatMonth(start)} - ${end ? formatMonth(end) : 'Present'}`;

	const sectionHeading = 'section-heading mb-4 break-after-avoid print:mb-2 print:text-black';
	const datesClass = 'meta whitespace-nowrap tabular-nums print:text-black';
	// The bullets print in the palette's accent (#102): a small easter egg, and markers print as text.
	// Links in the text print in it too (#109), like the contacts, so they read as clickable.
	const highlights =
		'body-copy print:text-sm/snug print:text-black print:marker:text-accent-print print:[&_a]:text-accent-print [&_li]:mb-1.5 print:[&_li]:mb-0.5';
</script>

<Seo title="Resume" description={resume?.summary || profile?.bioSummary || site.description} />

<svelte:head>
	<!-- eslint-disable-next-line svelte/no-at-html-tags -- a constant, not content -->
	{@html printSheet}
</svelte:head>

{#snippet companyHeading(employer: Employer)}
	<div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
		<h3 class="text-2xl font-semibold tracking-tight print:text-base print:font-bold">
			{employer.company}{#if employer.location}<span class="hidden text-sm font-normal print:inline"
					>{` · ${employer.location}`}</span
				>{/if}
		</h3>
		<span class={datesClass}>{dates(employer.startDate, employer.endDate)}</span>
	</div>
	{#if employer.location}
		<div class="mt-0.5 meta print:hidden">{employer.location}</div>
	{/if}
{/snippet}

<!-- eslint-disable svelte/no-at-html-tags -- highlights: the author's own Markdown from Strapi, rendered on the server -->
{#snippet roleEntry(role: Role, employer: Employer | null)}
	<article>
		<!-- Never ends a page (#96): the company heading (first role only), the role and its first
		     bullet stay together; the page may break between the bullets after that. -->
		<div class="break-inside-avoid">
			{#if employer}
				<div class="mb-5 print:mb-2">{@render companyHeading(employer)}</div>
			{/if}
			<div class="flex gap-3.5">
				<span aria-hidden="true" class="mt-2.5 size-2 shrink-0 rounded-full bg-accent print:hidden"
				></span>
				<div class="min-w-0 flex-1">
					<div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
						<h4 class="text-xl font-semibold print:text-sm print:italic">
							{role.role}
						</h4>
						<span class={datesClass}>{dates(role.startDate, role.endDate)}</span>
					</div>
					{#if role.location}
						<div class="mt-0.5 meta print:text-black">{role.location}</div>
					{/if}
					{#if role.highlightsHtml}
						<div class="mt-2.5 print:mt-1 {highlights} [&_ul]:list-disc [&_ul]:pl-5">
							{@html role.highlightsHtml}
						</div>
					{/if}
					{#if role.bullets.length > 0}
						<ul class="mt-2.5 list-disc pl-5 print:mt-1 {highlights}">
							<li>{@html role.bullets[0]}</li>
						</ul>
					{/if}
				</div>
			</div>
		</div>
		{#if role.bullets.length > 1}
			<!-- Lines up with the first bullet: past the dot and its gap on screen. -->
			<ul class="list-disc pl-10.5 print:pl-5 {highlights}">
				{#each role.bullets.slice(1) as bullet, k (k)}
					<li class="break-inside-avoid">{@html bullet}</li>
				{/each}
			</ul>
		{/if}
	</article>
{/snippet}
<!-- eslint-enable svelte/no-at-html-tags -->

<!-- Print lays out in block flow, with space-y margins rather than flex gaps: browsers ignore
     break-* avoid rules inside flex containers, which split a company heading from its roles (#96). -->
<div
	class="print-sheet page flex max-w-3xl flex-col gap-8 print:block print:max-w-none print:p-0 print:text-black"
>
	{#if resume}
		<div class="flex items-center justify-between gap-3 print:hidden">
			<p class="meta">
				Last updated <time datetime={resume.updatedAt}>{formatMonth(resume.updatedAt)}</time>
			</p>
			<!-- Needs JavaScript; without it, the browser's own Print works just as well. -->
			<button type="button" onclick={savePdf} data-eight-bit-cta class="hidden pill js:inline-flex">
				<Icon name="printer" size={18} />Save as PDF
			</button>
		</div>
	{/if}

	<div class="space-y-14 md:space-y-16 print:space-y-4">
		<ProfileHeader {profile} {contacts} printNote={resume?.location} {printEmail} />

		{#if !resume}
			<p class="body-copy">The full resume is on its way.</p>
		{:else}
			<section>
				<h2 class={sectionHeading}>Summary</h2>
				<p class="body-copy print:text-sm/snug print:text-black">
					{resume.summary}
				</p>
			</section>

			{#if resume.employers.length > 0}
				<section>
					<h2 class={sectionHeading}>Experience</h2>
					<div class="space-y-12 print:space-y-3">
						{#each resume.employers as employer, i (i)}
							<!-- One heading per company; a promotion is a second role under it (#94). -->
							<div class="space-y-5 print:space-y-2">
								{#each employer.roles as role, j (j)}
									{@render roleEntry(role, j === 0 ? employer : null)}
								{/each}
							</div>
						{/each}
					</div>
				</section>
			{/if}

			{#if resume.skillGroups.length > 0}
				<section class="break-inside-avoid">
					<h2 class={sectionHeading}>Skills</h2>
					<dl class="flex flex-col gap-3 print:gap-1">
						{#each resume.skillGroups as group, i (i)}
							<div
								class="grid grid-cols-1 gap-x-6 gap-y-0.5 sm:resume-skills-grid print:resume-skills-grid"
							>
								<dt class="text-base font-bold sm:pt-0.5 print:pt-0 print:text-sm">
									{group.label}
								</dt>
								<dd class="body-copy print:text-sm print:text-black">
									{group.skills}
								</dd>
							</div>
						{/each}
					</dl>
				</section>
			{/if}

			{#if resume.education.length > 0}
				<section class="break-inside-avoid">
					<h2 class={sectionHeading}>Education</h2>
					<div class="flex flex-col gap-3 print:gap-1">
						{#each resume.education as item, i (i)}
							<div
								class="flex flex-wrap justify-between gap-x-4 gap-y-0.5 body-copy print:text-sm print:text-black"
							>
								<span
									><strong class="text-ink print:text-black">{item.credential}</strong>
									· {item.school}</span
								>
								{#if item.year}<span class="text-muted tabular-nums print:text-black"
										>{item.year}</span
									>{/if}
							</div>
						{/each}
					</div>
				</section>
			{/if}

			{#if resume.certifications.length > 0}
				<section class="break-inside-avoid">
					<h2 class={sectionHeading}>Certifications</h2>
					<div class="flex flex-col gap-3 print:gap-1">
						{#each resume.certifications as cert, i (i)}
							<div
								class="flex flex-wrap justify-between gap-x-4 gap-y-0.5 body-copy print:text-sm print:text-black"
							>
								<span
									><strong class="text-ink print:text-black">{cert.name}</strong
									>{#if cert.issuer}{` · ${cert.issuer}`}{/if}</span
								>
								{#if cert.year}<span class="text-muted tabular-nums print:text-black"
										>{cert.year}</span
									>{/if}
							</div>
						{/each}
					</div>
				</section>
			{/if}
		{/if}
	</div>
	<!-- Only on paper (#63). Outlined, not text (#102): readers see it, ATS parsers (which read the
	     PDF's text) don't. The wording lives in scripts/print-notes.mjs: edit there, run pnpm print-notes. -->
	<img src="/print-notes/{palette}.svg" alt="" class="hidden print:mt-4 print:block" />
</div>

<script lang="ts">
	// F-resume-*: on screen inside the site chrome, and a clean Letter-size print ("Save as PDF").
	// Content comes from the Strapi Resume; the header (name, tagline, links) from the Profile.
	import { page } from '$app/state';
	import Icon from '$lib/components/Icon.svelte';
	import { formatMonth } from '$lib/format';
	import { site } from '$lib/site';

	let { data } = $props();

	const resume = $derived(data.resume);
	const profile = $derived(data.profile);

	/** Link text without the scheme: "linkedin.com/in/…". It prints as-is, so it doubles as the URL. */
	const bare = (url: string) => url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/+$/, '');

	type Contact = { href: string; text: string; icon: 'mail' | 'globe' | 'external' };
	const contacts = $derived(
		[
			profile?.email && { href: `mailto:${profile.email}`, text: profile.email, icon: 'mail' },
			{ href: page.url.origin, text: bare(page.url.origin), icon: 'globe' },
			profile?.linkedin && {
				href: profile.linkedin,
				text: bare(profile.linkedin),
				icon: 'external'
			},
			profile?.github && { href: profile.github, text: bare(profile.github), icon: 'external' }
		].filter(Boolean) as Contact[]
	);

	const dates = (start: string, end: string | null) =>
		`${formatMonth(start)} – ${end ? formatMonth(end) : 'Present'}`;

	const sectionHeading =
		'mb-2.5 border-b-2 border-neutral-900 pb-1.5 text-xs font-semibold tracking-widest uppercase break-after-avoid dark:border-neutral-100 print:border-b print:border-black';
</script>

<svelte:head>
	<title>Resume · {profile?.name ?? site.name}</title>
	<meta name="description" content={resume.summary} />
</svelte:head>

<div
	class="mx-auto flex max-w-[50rem] flex-col gap-6 px-5 pt-6 pb-14 md:px-8 md:pt-10 print:max-w-none print:p-0 print:text-black"
>
	<div class="flex items-center justify-between gap-3 print:hidden">
		<p class="text-sm text-neutral-600 dark:text-neutral-400">
			Last updated <time datetime={resume.updatedAt}>{formatMonth(resume.updatedAt)}</time>
		</p>
		<!-- Needs JavaScript; without it, the browser's own Print works just as well. -->
		<button
			type="button"
			onclick={() => window.print()}
			class="hidden min-h-11 items-center gap-2 border border-neutral-900 px-4 dark:border-neutral-100 js:inline-flex"
		>
			<Icon name="printer" size={18} />Save as PDF
		</button>
	</div>

	<div class="flex flex-col gap-9 print:gap-5">
		<header
			class="flex flex-col gap-2 print:gap-1.5 print:border-b print:border-black print:pb-3.5"
		>
			<h1 class="text-3xl/[1.1] font-medium tracking-tight md:text-4xl/[1.1] print:text-3xl/[1.1]">
				{profile?.name ?? site.name}
			</h1>
			{#if profile?.tagline}
				<p
					class="text-lg text-neutral-600 italic dark:text-neutral-400 print:text-base print:text-black"
				>
					{profile.tagline}
				</p>
			{/if}
			<ul
				class="flex flex-wrap gap-x-4 text-[15px] print:gap-x-3.5 print:gap-y-1 print:text-[13px]"
			>
				{#each contacts as contact (contact.href)}
					<li>
						<!-- eslint-disable svelte/no-navigation-without-resolve -- mailto:, the site's origin and external profiles -->
						<a
							href={contact.href}
							class="inline-flex min-h-11 items-center gap-1.5 text-red-700 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 print:min-h-0 print:text-black"
						>
							<Icon name={contact.icon} size={15} class="print:hidden" />{contact.text}
						</a>
						<!-- eslint-enable svelte/no-navigation-without-resolve -->
					</li>
				{/each}
				{#if resume.location}
					<li class="hidden print:block">{resume.location}</li>
				{/if}
			</ul>
		</header>

		<section>
			<h2 class={sectionHeading}>Summary</h2>
			<p
				class="text-[17px]/relaxed text-neutral-700 dark:text-neutral-300 print:text-sm/relaxed print:text-black"
			>
				{resume.summary}
			</p>
		</section>

		{#if resume.experience.length > 0}
			<section>
				<h2 class={sectionHeading}>Experience</h2>
				{#each resume.experience as job, i (i)}
					<article class="mb-5.5 break-inside-avoid print:mb-3.5">
						<div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
							<h3 class="text-lg font-bold print:text-[15px]">
								{job.role}<span
									class="font-normal text-neutral-600 dark:text-neutral-400 print:text-black"
									>{` · ${job.company}`}</span
								>
							</h3>
							<span
								class="text-sm text-neutral-600 tabular-nums dark:text-neutral-400 print:text-[13px] print:text-black"
							>
								{dates(job.startDate, job.endDate)}
							</span>
						</div>
						{#if job.location}
							<div
								class="mt-0.5 text-sm text-neutral-600 dark:text-neutral-400 print:text-[13px] print:text-black"
							>
								{job.location}
							</div>
						{/if}
						{#if job.highlightsHtml}
							<div
								class="mt-1.5 text-[17px]/[1.55] text-neutral-700 dark:text-neutral-300 print:text-sm/[1.55] print:text-black [&_li]:mb-0.5 [&_ul]:list-disc [&_ul]:pl-5"
							>
								<!-- eslint-disable-next-line svelte/no-at-html-tags -- the author's own Markdown from Strapi, rendered on the server -->
								{@html job.highlightsHtml}
							</div>
						{/if}
					</article>
				{/each}
			</section>
		{/if}

		{#if resume.skillGroups.length > 0}
			<section class="break-inside-avoid">
				<h2 class={sectionHeading}>Skills</h2>
				<dl>
					{#each resume.skillGroups as group, i (i)}
						<div
							class="grid grid-cols-2 gap-x-4 gap-y-0.5 border-t border-neutral-200 py-1.5 sm:grid-cols-[8.75rem_minmax(0,1fr)] dark:border-neutral-800 print:grid-cols-[8.75rem_minmax(0,1fr)] print:border-0"
						>
							<dt class="text-[15px] font-bold print:text-[13px]">{group.label}</dt>
							<dd
								class="text-[17px] text-neutral-700 dark:text-neutral-300 print:text-sm print:text-black"
							>
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
				{#each resume.education as item, i (i)}
					<div
						class="flex flex-wrap justify-between gap-x-4 gap-y-1 text-[17px] text-neutral-700 dark:text-neutral-300 print:text-sm print:text-black"
					>
						<span
							><strong class="text-neutral-900 dark:text-neutral-100 print:text-black"
								>{item.credential}</strong
							>
							· {item.school}</span
						>
						{#if item.year}<span class="text-neutral-600 dark:text-neutral-400 print:text-black"
								>{item.year}</span
							>{/if}
					</div>
				{/each}
			</section>
		{/if}
	</div>
</div>

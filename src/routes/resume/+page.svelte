<script lang="ts">
	// RRC-* (#94, Promotion path): on screen inside the site chrome, and a one-column Letter print
	// ("Save as PDF") that reads cleanly in applicant tracking systems: standard headings, no icons.
	// Content comes from the Strapi Resume; the header (name, tagline, links) from the Profile.
	import { page } from '$app/state';
	import Icon from '$lib/components/Icon.svelte';
	import Seo from '$lib/components/Seo.svelte';
	import { formatMonth } from '$lib/format';
	import { site } from '$lib/site';

	let { data } = $props();

	const resume = $derived(data.resume);
	const profile = $derived(data.profile);

	/** Link text without the scheme: "linkedin.com/in/…". It prints as-is, so it doubles as the URL. */
	const bare = (url: string) => url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/+$/, '');

	type Contact = { href: string; text: string; icon: 'mail' | 'globe' | 'linkedin' | 'github' };
	const contacts = $derived(
		[
			profile?.email && { href: `mailto:${profile.email}`, text: profile.email, icon: 'mail' },
			{ href: page.url.origin, text: bare(page.url.origin), icon: 'globe' },
			profile?.linkedin && {
				href: profile.linkedin,
				text: bare(profile.linkedin),
				icon: 'linkedin'
			},
			profile?.github && { href: profile.github, text: bare(profile.github), icon: 'github' }
		].filter(Boolean) as Contact[]
	);

	/** "Apr 2021 – Present". */
	const dates = (start: string, end: string | null) =>
		`${formatMonth(start)} – ${end ? formatMonth(end) : 'Present'}`;

	const sectionHeading = 'section-heading mb-4 break-after-avoid print:mb-2 print:text-black';
	const datesClass = 'meta whitespace-nowrap tabular-nums print:text-black';
</script>

<Seo title="Resume" description={resume?.summary || profile?.bioSummary || site.description} />

<div class="page flex max-w-3xl flex-col gap-8 print:max-w-none print:p-0 print:text-black">
	{#if resume}
		<div class="flex items-center justify-between gap-3 print:hidden">
			<p class="meta">
				Last updated <time datetime={resume.updatedAt}>{formatMonth(resume.updatedAt)}</time>
			</p>
			<!-- Needs JavaScript; without it, the browser's own Print works just as well. -->
			<button type="button" onclick={() => window.print()} class="hidden pill js:inline-flex">
				<Icon name="printer" size={18} />Save as PDF
			</button>
		</div>
	{/if}

	<div class="flex flex-col gap-14 md:gap-16 print:gap-5">
		<header class="flex flex-col gap-2.5 print:gap-1">
			<h1 class="page-title print:text-3xl">
				{profile?.name ?? site.name}
			</h1>
			{#if profile?.tagline}
				<p class="standfirst print:text-base print:text-black">
					{profile.tagline}
				</p>
			{/if}
			<ul class="flex flex-wrap gap-x-4 text-sm print:gap-x-3.5 print:gap-y-0.5">
				{#each contacts as contact (contact.href)}
					<li>
						<!-- eslint-disable svelte/no-navigation-without-resolve -- mailto:, the site's origin and external profiles -->
						<a
							href={contact.href}
							class="tap-target gap-1.5 text-accent hover:text-accent-hover print:min-h-0 print:text-black"
						>
							<Icon name={contact.icon} size={14} class="print:hidden" />{contact.text}
						</a>
						<!-- eslint-enable svelte/no-navigation-without-resolve -->
					</li>
				{/each}
				{#if resume?.location}
					<li class="hidden print:block">{resume.location}</li>
				{/if}
			</ul>
		</header>

		{#if !resume}
			<p class="body-copy">The full resume is on its way.</p>
		{:else}
			<section>
				<h2 class={sectionHeading}>Summary</h2>
				<p class="body-copy print:text-sm/relaxed print:text-black">
					{resume.summary}
				</p>
			</section>

			{#if resume.employers.length > 0}
				<section>
					<h2 class={sectionHeading}>Experience</h2>
					<div class="flex flex-col gap-12 print:gap-4">
						{#each resume.employers as employer, i (i)}
							<!-- One heading per company; a promotion is a second role under it (#94). -->
							<div class="flex flex-col gap-5 print:gap-2.5">
								<div class="break-after-avoid">
									<div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
										<h3
											class="text-2xl font-semibold tracking-tight print:text-base print:font-bold"
										>
											{employer.company}{#if employer.location}<span
													class="hidden text-sm font-normal print:inline"
													>{` · ${employer.location}`}</span
												>{/if}
										</h3>
										<span class={datesClass}>{dates(employer.startDate, employer.endDate)}</span>
									</div>
									{#if employer.location}
										<div class="mt-0.5 meta print:hidden">{employer.location}</div>
									{/if}
								</div>
								{#each employer.roles as role, j (j)}
									<article class="flex break-inside-avoid gap-3.5">
										<span
											aria-hidden="true"
											class="mt-2.5 size-2 shrink-0 rounded-full bg-accent print:hidden"
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
												<div
													class="mt-2.5 body-copy print:mt-1 print:text-sm/relaxed print:text-black [&_li]:mb-1.5 print:[&_li]:mb-0.5 [&_ul]:list-disc [&_ul]:pl-5"
												>
													<!-- eslint-disable-next-line svelte/no-at-html-tags -- the author's own Markdown from Strapi, rendered on the server -->
													{@html role.highlightsHtml}
												</div>
											{/if}
										</div>
									</article>
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
	<!-- Only on paper (#63). Draft copy: edit freely. -->
	<p class="hidden text-xs text-faint print:mt-4 print:block">
		Printed from {new URL(site.url).host}/resume. Thanks for reading it on paper.
	</p>
</div>

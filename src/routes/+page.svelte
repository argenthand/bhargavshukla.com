<script lang="ts">
	import { resolve } from '$app/paths';
	import Icon from '$lib/components/Icon.svelte';
	import PostMeta from '$lib/components/PostMeta.svelte';
	import { isLive, site } from '$lib/site';

	let { data } = $props();

	const [lead, ...rest] = $derived(data.home.posts);

	// F-home-v2: the intro from the Strapi profile (#42), then up to 3 featured posts.
	const profile = $derived(data.profile);
	// The Resume link shows once /resume ships (#5); contact links only when set in the profile.
	type IntroLink = {
		href: string;
		label: string;
		icon: 'arrow-right' | 'mail' | 'external';
		size: number;
		external?: boolean;
	};
	const links = $derived(
		[
			isLive('/resume') && { href: '/resume', label: 'Resume', icon: 'arrow-right', size: 16 },
			profile?.email && { href: `mailto:${profile.email}`, label: 'Email', icon: 'mail', size: 14 },
			profile?.linkedin && {
				href: profile.linkedin,
				label: 'LinkedIn',
				icon: 'external',
				size: 14,
				external: true
			},
			profile?.github && {
				href: profile.github,
				label: 'GitHub',
				icon: 'external',
				size: 14,
				external: true
			}
		].filter(Boolean) as IntroLink[]
	);
</script>

<svelte:head>
	<title>{site.name}</title>
</svelte:head>

<div class="mx-auto max-w-5xl px-5 md:px-8">
	<section
		aria-label="About"
		class="flex flex-col gap-4 py-10 md:pt-14 lg:grid lg:grid-cols-12 lg:gap-8 lg:pt-16 lg:pb-14"
	>
		<div class="lg:col-span-5">
			<h1 class="text-4xl/[1.1] font-medium tracking-tight">{profile?.name ?? site.name}</h1>
			{#if profile}
				<p class="mt-2 text-xl text-neutral-600 italic dark:text-neutral-400">{profile.tagline}</p>
			{/if}
		</div>
		<div
			class="flex flex-col gap-4 text-lg/[1.7] text-neutral-700 lg:col-span-7 dark:text-neutral-300"
		>
			{#if profile}
				<div
					class="flex flex-col gap-4 [&_a]:text-red-700 [&_a]:underline [&_a]:underline-offset-4 dark:[&_a]:text-red-400"
				>
					<!-- eslint-disable-next-line svelte/no-at-html-tags -- the author's own Markdown from Strapi, rendered on the server -->
					{@html profile.bioHtml}
				</div>
			{/if}
			<ul class="flex flex-wrap items-center gap-x-5 gap-y-1">
				{#each links as link (link.label)}
					<li>
						<!-- eslint-disable svelte/no-navigation-without-resolve -- /resume is only listed once live; the rest are mailto: or external -->
						<a
							href={link.href}
							target={link.external ? '_blank' : undefined}
							rel={link.external ? 'noopener noreferrer' : undefined}
							class="inline-flex min-h-11 items-center gap-1.5 text-red-700 underline decoration-1 underline-offset-4 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
						>
							{link.label}<Icon name={link.icon} size={link.size} />
							{#if link.external}<span class="sr-only"> (opens in a new tab)</span>{/if}
						</a>
						<!-- eslint-enable svelte/no-navigation-without-resolve -->
					</li>
				{/each}
			</ul>
		</div>
	</section>

	{#if lead}
		<section aria-labelledby="featured">
			<h2
				id="featured"
				class="border-t-2 border-neutral-900 pt-2.5 text-xs font-semibold tracking-widest uppercase dark:border-neutral-100"
			>
				{data.home.heading}
			</h2>
			{@render story(lead, true)}
			{#if rest.length > 0}
				<div class="md:grid md:grid-cols-2 md:gap-8">
					{#each rest as post (post.slug)}
						{@render story(post, false)}
					{/each}
				</div>
			{/if}
			<div class="pt-3 pb-12 md:border-t md:border-neutral-200 dark:md:border-neutral-800">
				<a
					href={resolve('/blog')}
					class="inline-flex min-h-11 items-center gap-2 font-semibold text-red-700 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
				>
					View all writing <Icon name="arrow-right" />
				</a>
			</div>
		</section>
	{/if}
</div>

{#snippet story(post: (typeof data.home.posts)[number], isLead: boolean)}
	<article
		class={[
			'flex flex-col gap-2 border-b border-neutral-200 py-5 dark:border-neutral-800',
			!isLead && 'md:border-b-0'
		]}
	>
		<PostMeta {post} />
		<h3>
			<a
				href={resolve('/blog/[slug]', { slug: post.slug })}
				class={[
					'text-[22px]/snug font-semibold text-balance hover:text-red-700 dark:hover:text-red-400',
					isLead ? 'md:text-3xl/snug' : 'md:text-2xl/snug'
				]}
			>
				{post.title}
			</a>
		</h3>
		<p class="line-clamp-2 text-[17px]/[1.55] text-neutral-600 dark:text-neutral-400">
			{post.summary}
		</p>
	</article>
{/snippet}

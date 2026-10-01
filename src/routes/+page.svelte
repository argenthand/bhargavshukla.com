<script lang="ts">
	import { resolve } from '$app/paths';
	import Icon from '$lib/components/Icon.svelte';
	import PostMeta from '$lib/components/PostMeta.svelte';
	import Seo from '$lib/components/Seo.svelte';
	import { isLive, site } from '$lib/site';

	let { data } = $props();

	// F-intro-r (#59): the intro from the Strapi profile (#42) with an optional round headshot,
	// 768 wide like Writing; then up to 3 featured posts, all styled alike (#66).
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

<Seo description={profile?.bioSummary || site.description} />

<div class="page max-w-3xl">
	<section aria-label="About" class="flex flex-col gap-4 pb-14">
		<div class="flex items-center gap-4 md:gap-5">
			{#if profile?.photo}
				<img
					src={profile.photo.src}
					srcset={profile.photo.srcset}
					sizes="(min-width: 768px) 120px, 112px"
					alt={profile.photo.alt}
					width={profile.photo.width}
					height={profile.photo.height}
					decoding="async"
					class="size-28 shrink-0 rounded-full bg-neutral-100 object-cover md:size-30 dark:bg-neutral-900"
				/>
			{/if}
			<div class="min-w-0">
				<!-- The layout hides the header's name while this heading is on screen (#59). -->
				<h1 id="intro-name" class="page-title">
					{profile?.name ?? site.name}
				</h1>
				{#if profile}
					<p class="mt-2 standfirst">{profile.tagline}</p>
				{/if}
			</div>
		</div>
		<div class="flex flex-col gap-4 body-copy">
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
							class="link-cta"
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

	{#if data.home.posts.length > 0}
		<section aria-labelledby="featured">
			<h2 id="featured" class="section-heading">{data.home.heading}</h2>
			{#each data.home.posts as post (post.slug)}
				<article class="list-entry border-b border-neutral-200 dark:border-neutral-800">
					<PostMeta {post} />
					<h3 class="list-title">
						<a
							href={resolve('/blog/[slug]', { slug: post.slug })}
							class="hover:text-red-700 dark:hover:text-red-400"
						>
							{post.title}
						</a>
					</h3>
					<p class="summary">{post.summary}</p>
				</article>
			{/each}
			<div class="pt-3">
				<a href={resolve('/blog')} class="link-cta">View all writing <Icon name="arrow-right" /></a>
			</div>
		</section>
	{/if}
</div>

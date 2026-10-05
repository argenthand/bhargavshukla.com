<script lang="ts">
	import { resolve } from '$app/paths';
	import Icon from '$lib/components/Icon.svelte';
	import PostMeta from '$lib/components/PostMeta.svelte';
	import ProfileHeader, { profileContacts } from '$lib/components/ProfileHeader.svelte';
	import Seo from '$lib/components/Seo.svelte';
	import { titleTransition } from '$lib/motion';
	import { isLive, site } from '$lib/site';

	let { data } = $props();

	// F-intro-r (#59) with the shared profile header (#99, option B): headshot, name, tagline and the
	// contacts; then the bio and the Resume link. Up to 3 featured posts follow, all styled alike (#66).
	const profile = $derived(data.profile);
	const contacts = $derived(profileContacts(profile));
</script>

<Seo description={profile?.bioSummary || site.description} />

<div class="page max-w-3xl">
	<section aria-label="About" class="flex flex-col gap-7 pb-14">
		<!-- The layout hides the header's name while this heading is on screen (#59, #144). -->
		<ProfileHeader {profile} {contacts} intro />
		<div class="flex flex-col gap-4 body-copy">
			{#if profile}
				<div class="flex flex-col gap-4 [&_a]:text-accent [&_a]:underline [&_a]:underline-offset-4">
					<!-- eslint-disable-next-line svelte/no-at-html-tags -- the author's own Markdown from Strapi, rendered on the server -->
					{@html profile.bioHtml}
				</div>
			{/if}
			{#if isLive('/resume')}
				<div>
					<a href={resolve('/resume')} class="link-cta"
						>Resume <Icon name="arrow-right" size={16} /></a
					>
				</div>
			{/if}
		</div>
	</section>

	{#if data.home.posts.length > 0}
		<section aria-labelledby="featured">
			<h2 id="featured" class="section-heading">{data.home.heading}</h2>
			{#each data.home.posts as post (post.slug)}
				<article class="list-entry">
					<PostMeta {post} reads />
					<h3
						class="list-title"
						data-title-transition
						style:view-transition-name={titleTransition('post', post.slug)}
					>
						<a href={resolve('/blog/[slug]', { slug: post.slug })} class="hover:text-accent">
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

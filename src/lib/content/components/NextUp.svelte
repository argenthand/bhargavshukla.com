<script lang="ts">
	// Recommended reading (docs/design.md): a Next up card for the first pick and an "Also:" line
	// for the second. With no picks the page renders nothing at all.
	import { resolve } from '$app/paths';
	import { Icon } from '$lib/site';
	import PostMeta from './PostMeta.svelte';
	import { formatDate, isoDay, shownDate } from '../format';
	import type { PostSummary } from '../types';

	let { posts }: { posts: PostSummary[] } = $props();

	const [first, second] = $derived(posts);
</script>

{#if first}
	<section aria-label="Recommended reading" class="mt-12">
		<a
			href={resolve('/blog/[slug]', { slug: first.slug })}
			class="flex flex-col gap-2 surface p-5 hover:bg-chip"
		>
			<span class="flex items-center justify-between label-accent">
				Next up <Icon name="arrow-right" size={18} />
			</span>
			<span class="list-title">{first.title}</span>
			<span class="summary">{first.summary}</span>
			<PostMeta post={first} />
		</a>
		{#if second}
			<p class="flex flex-wrap items-baseline gap-3 px-1 pt-3">
				<span class="meta">Also:</span>
				<a
					href={resolve('/blog/[slug]', { slug: second.slug })}
					class="tap-target font-medium link-quiet"
				>
					{second.title}
				</a>
				<time datetime={isoDay(shownDate(second))} class="meta">
					{formatDate(shownDate(second))}
				</time>
			</p>
		{/if}
	</section>
{/if}

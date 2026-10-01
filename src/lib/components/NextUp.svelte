<script lang="ts">
	// Recommended reading (docs/design.md): a Next up card for the first pick and an "Also:" line
	// for the second. With no picks the page renders nothing at all.
	import { resolve } from '$app/paths';
	import Icon from '$lib/components/Icon.svelte';
	import PostMeta from '$lib/components/PostMeta.svelte';
	import { formatDate, isoDay, shownDate } from '$lib/format';
	import { titleTransition } from '$lib/motion';
	import type { PostSummary } from '$lib/types/content';

	let { posts }: { posts: PostSummary[] } = $props();

	const [first, second] = $derived(posts);
</script>

{#if first}
	<section aria-label="Recommended reading" class="mt-12">
		<a
			href={resolve('/blog/[slug]', { slug: first.slug })}
			class="flex flex-col gap-2 border border-neutral-200 bg-neutral-50 p-5 hover:border-neutral-900 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-100"
		>
			<span class="flex items-center justify-between label-accent">
				Next up <Icon name="arrow-right" size={18} />
			</span>
			<span class="list-title" style:view-transition-name={titleTransition('post', first.slug)}>
				{first.title}
			</span>
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

<script lang="ts">
	// Recommended reading (docs/design.md): a Next up card for the first pick and an "Also:" line
	// for the second. With no picks the page renders nothing at all.
	import { resolve } from '$app/paths';
	import Icon from '$lib/components/Icon.svelte';
	import PostMeta from '$lib/components/PostMeta.svelte';
	import { formatDate, isoDay, shownDate } from '$lib/format';
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
			<span
				class="flex items-center justify-between text-sm font-semibold text-red-700 dark:text-red-400"
			>
				Next up <Icon name="arrow-right" size={18} />
			</span>
			<span class="text-xl font-semibold text-balance md:text-2xl">{first.title}</span>
			<span class="line-clamp-2 text-neutral-600 dark:text-neutral-400">{first.summary}</span>
			<PostMeta post={first} />
		</a>
		{#if second}
			<p class="flex flex-wrap items-baseline gap-3 px-1 pt-3">
				<span class="text-sm text-neutral-600 dark:text-neutral-400">Also:</span>
				<a
					href={resolve('/blog/[slug]', { slug: second.slug })}
					class="inline-flex min-h-11 items-center font-medium underline decoration-neutral-200 underline-offset-4 hover:decoration-red-700 dark:decoration-neutral-800 dark:hover:decoration-red-400"
				>
					{second.title}
				</a>
				<time
					datetime={isoDay(shownDate(second))}
					class="text-sm text-neutral-600 dark:text-neutral-400"
				>
					{formatDate(shownDate(second))}
				</time>
			</p>
		{/if}
	</section>
{/if}

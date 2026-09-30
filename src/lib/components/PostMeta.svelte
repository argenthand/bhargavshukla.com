<script lang="ts">
	import { formatDate, isoDay, shownDate } from '$lib/format';
	import type { PostSummary } from '$lib/types/content';

	// Category label · date, as in list rows, featured posts and the Next up card.
	let { post }: { post: Pick<PostSummary, 'category' | 'displayDate' | 'publishedAt'> } = $props();
</script>

<span class="flex flex-wrap items-center gap-2">
	{#if post.category}
		<span class="text-xs font-semibold tracking-widest text-red-700 uppercase dark:text-red-400">
			{post.category.name}
		</span>
		<span aria-hidden="true" class="text-neutral-600 dark:text-neutral-400">·</span>
	{/if}
	<time datetime={isoDay(shownDate(post))} class="text-sm text-neutral-600 dark:text-neutral-400">
		{formatDate(shownDate(post))}
	</time>
</span>

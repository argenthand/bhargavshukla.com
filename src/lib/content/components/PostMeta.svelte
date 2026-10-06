<script lang="ts">
	import { resolve } from '$app/paths';
	import { ReadCount } from '$lib/analytics';
	import { formatDate, isoDay, shownDate } from '../format';
	import type { PostSummary } from '../types';

	// Category label · date, as in list rows, featured posts and the Next up card.
	// In draft preview (#57) an unpublished post says so instead of showing a date. With `reads`
	// (the home page, #87), its read count follows the date.
	let {
		post,
		reads = false
	}: {
		post: Pick<PostSummary, 'slug' | 'category' | 'displayDate' | 'publishedAt' | 'draft'>;
		reads?: boolean;
	} = $props();
</script>

<span class="flex flex-wrap items-center gap-2">
	{#if post.category}
		<span class="label-accent">
			{post.category.name}
		</span>
		<span aria-hidden="true" class="text-muted">·</span>
	{/if}
	{#if post.draft}
		<span class="meta">Not published</span>
		<span class="draft-badge">Draft</span>
	{:else}
		<time datetime={isoDay(shownDate(post))} class="meta">
			{formatDate(shownDate(post))}
		</time>
		{#if reads}
			<ReadCount path={resolve('/blog/[slug]', { slug: post.slug })} />
		{/if}
	{/if}
</span>

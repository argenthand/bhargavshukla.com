<script lang="ts">
	// One aside (F-aside-*): back to the stream, the aside, then Newer / Older.
	import { resolve } from '$app/paths';
	import AsideItem from '$lib/components/AsideItem.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import Seo from '$lib/components/Seo.svelte';

	let { data } = $props();
</script>

<Seo
	title={data.aside.label}
	description={data.description || data.aside.label}
	article={{ publishedTime: data.aside.publishedAt }}
/>

<div class="mx-auto flex max-w-3xl flex-col gap-7 px-5 pt-8 pb-14 md:px-8 md:pt-10">
	<a
		href={resolve('/asides')}
		class="inline-flex min-h-11 items-center gap-1.5 self-start text-red-700 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
	>
		<Icon name="arrow-left" />All asides
	</a>

	<article>
		<AsideItem aside={data.aside} standalone />
	</article>

	{#if data.newer || data.older}
		<nav
			aria-label="More asides"
			class="grid grid-cols-2 gap-4 border-t border-neutral-200 pt-3 dark:border-neutral-800"
		>
			{#if data.newer}
				<a
					href={resolve('/asides/[slug]', { slug: data.newer.slug })}
					class="group flex min-h-11 flex-col gap-0.5"
				>
					<span
						class="inline-flex items-center gap-1.5 text-sm text-neutral-600 dark:text-neutral-400"
					>
						<Icon name="arrow-left" size={14} />Newer
					</span>
					<span class="font-medium group-hover:text-red-700 dark:group-hover:text-red-400">
						{data.newer.label}
					</span>
				</a>
			{:else}
				<span></span>
			{/if}
			{#if data.older}
				<a
					href={resolve('/asides/[slug]', { slug: data.older.slug })}
					class="group flex min-h-11 flex-col items-end gap-0.5 text-right"
				>
					<span
						class="inline-flex items-center gap-1.5 text-sm text-neutral-600 dark:text-neutral-400"
					>
						Older<Icon name="arrow-right" size={14} />
					</span>
					<span class="font-medium group-hover:text-red-700 dark:group-hover:text-red-400">
						{data.older.label}
					</span>
				</a>
			{/if}
		</nav>
	{/if}
</div>

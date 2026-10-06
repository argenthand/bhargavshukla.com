<script lang="ts">
	// One aside (F-aside-*): back to the stream, the aside, then Newer / Older.
	import { resolve } from '$app/paths';
	import { AsideItem } from '$lib/content';
	import { Icon, Seo, CARD, cardUrl } from '$lib/site';

	let { data } = $props();
</script>

<Seo
	title={data.aside.label}
	description={data.description || data.aside.label}
	article={{ publishedTime: data.aside.publishedAt }}
	image={{
		url: cardUrl(`/asides/${data.aside.slug}`, data.aside.updatedAt),
		alt: data.aside.label,
		...CARD
	}}
/>

<div class="page flex max-w-3xl flex-col gap-7">
	<a href={resolve('/asides')} class="link-cta self-start">
		<Icon name="arrow-left" />All asides
	</a>

	<article>
		<AsideItem aside={data.aside} standalone />
	</article>

	{#if data.newer || data.older}
		<nav aria-label="More asides" class="grid grid-cols-2 gap-4">
			{#if data.newer}
				<a
					href={resolve('/asides/[slug]', { slug: data.newer.slug })}
					class="group flex min-h-11 flex-col gap-0.5"
				>
					<span class="inline-flex items-center gap-1.5 meta">
						<Icon name="arrow-left" size={14} />Newer
					</span>
					<span class="font-medium group-hover:text-accent">
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
					<span class="inline-flex items-center gap-1.5 meta">
						Older<Icon name="arrow-right" size={14} />
					</span>
					<span class="font-medium group-hover:text-accent">
						{data.older.label}
					</span>
				</a>
			{/if}
		</nav>
	{/if}
</div>

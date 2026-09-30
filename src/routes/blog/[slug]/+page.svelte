<script lang="ts">
	import NextUp from '$lib/components/NextUp.svelte';
	import Prose from '$lib/components/Prose.svelte';
	import Seo from '$lib/components/Seo.svelte';
	import Toc from '$lib/components/Toc.svelte';
	import { formatDate, isoDay, shownDate, updatedDate } from '$lib/format';

	let { data } = $props();

	const post = $derived(data.post);
	const updated = $derived(updatedDate(post));
	// Share image: the SEO override, else the cover.
	const ogImage = $derived.by(() => {
		const img = post.seo.ogImage ?? post.cover;
		return img && { url: img.url, alt: img.alternativeText, width: img.width, height: img.height };
	});
	// The ToC only earns its space with 2 or more sections.
	const showToc = $derived(data.headings.filter((h) => h.level === 2).length >= 2);
	// On lg+, the title and cover span the article + ToC columns (964px). Without a ToC they match
	// the article column (680px), so everything lines up.
</script>

<Seo
	title={post.seo.title}
	description={post.seo.description}
	canonical={post.seo.canonical}
	image={ogImage}
	article={{
		publishedTime: shownDate(post),
		modifiedTime: post.updatedAt,
		section: post.category?.name
	}}
/>

<div class="px-5 pt-8 pb-14 md:px-8 lg:pt-14 lg:pb-16">
	<header
		class={[
			'mx-auto mb-7 flex max-w-[42.5rem] flex-col gap-3.5 lg:mb-10 lg:items-center lg:text-center',
			showToc && 'lg:max-w-[60.25rem]'
		]}
	>
		{#if post.category}
			<span class="text-xs font-semibold tracking-widest text-red-700 uppercase dark:text-red-400">
				{post.category.name}
			</span>
		{/if}
		<h1 class="text-3xl/tight font-medium tracking-tight text-balance lg:text-4xl/tight">
			{post.title}
		</h1>
		<p class="flex flex-wrap items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
			<time datetime={isoDay(shownDate(post))}>{formatDate(shownDate(post))}</time>
			{#if updated}
				<span aria-hidden="true">·</span>
				<time datetime={isoDay(updated)}>Updated {formatDate(updated)}</time>
			{/if}
		</p>
	</header>

	{#if post.cover}
		<!-- Full-bleed on phones. -->
		<div
			class={[
				'-mx-5 mb-7 md:mx-auto md:max-w-[42.5rem] lg:mb-12',
				showToc && 'lg:max-w-[60.25rem]'
			]}
		>
			<img
				src={post.cover.url}
				alt={post.cover.alternativeText ?? ''}
				width={post.cover.width}
				height={post.cover.height}
				class="h-auto w-full"
			/>
		</div>
	{/if}

	<div
		class={[
			'mx-auto max-w-[42.5rem]',
			showToc &&
				'lg:grid lg:max-w-none lg:grid-cols-[minmax(0,42.5rem)_13.75rem] lg:justify-center lg:gap-16'
		]}
	>
		<article class="min-w-0">
			{#if showToc}
				<!-- A direct child of the article, so the pill stays stuck for the whole post. -->
				<Toc headings={data.headings} variant="pill" />
			{/if}
			<Prose html={data.html} />
			<NextUp posts={data.nextUp} />
		</article>
		{#if showToc}
			<aside class="hidden self-start pt-1.5 lg:sticky lg:top-24 lg:block">
				<Toc headings={data.headings} variant="sidebar" />
			</aside>
		{/if}
	</div>
</div>

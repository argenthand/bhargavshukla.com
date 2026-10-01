<script lang="ts">
	import NextUp from '$lib/components/NextUp.svelte';
	import Prose from '$lib/components/Prose.svelte';
	import ReadingProgress from '$lib/components/ReadingProgress.svelte';
	import Seo from '$lib/components/Seo.svelte';
	import Toc from '$lib/components/Toc.svelte';
	import { formatDate, isoDay, shownDate, updatedDate } from '$lib/format';
	import { titleTransition } from '$lib/motion';
	import { CARD, cardUrl } from '$lib/share';

	let { data } = $props();

	const post = $derived(data.post);
	const updated = $derived(updatedDate(post));
	// Share image: the SEO override, else the cover.
	const ogImage = $derived.by(() => {
		const seo = post.seo.ogImage;
		if (seo)
			return { url: seo.url, alt: seo.alternativeText, width: seo.width, height: seo.height };
		const cover = post.cover;
		if (cover) return { url: cover.src, alt: cover.alt, width: cover.width, height: cover.height };
		// No cover: the post's own share card (#62).
		return { url: cardUrl(`/blog/${post.slug}`, post.updatedAt), alt: post.title, ...CARD };
	});
	// The ToC only earns its space with 2 or more sections.
	const showToc = $derived(data.headings.filter((h) => h.level === 2).length >= 2);
	let article = $state<HTMLElement>();
	// On lg+, the title and cover span the article + ToC columns (960px). Without a ToC they match
	// the article column (672px), so everything lines up.
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

<ReadingProgress target={article} />

<div class="page">
	<header
		class={[
			'mx-auto mb-7 flex max-w-article flex-col gap-3.5 lg:mb-10 lg:items-center lg:text-center',
			showToc && 'lg:max-w-article-wide'
		]}
	>
		{#if post.category}
			<span class="label-accent">
				{post.category.name}
			</span>
		{/if}
		<h1
			class="page-title"
			data-title-transition
			style:view-transition-name={titleTransition('post', post.slug)}
		>
			{post.title}
		</h1>
		<p class="flex flex-wrap items-center gap-2 meta">
			{#if post.draft}
				<span>Not published</span>
				<span class="draft-badge">Draft</span>
			{:else}
				<time datetime={isoDay(shownDate(post))}>{formatDate(shownDate(post))}</time>
			{/if}
			{#if updated && !post.draft}
				<span aria-hidden="true">·</span>
				<time datetime={isoDay(updated)}>Updated {formatDate(updated)}</time>
			{/if}
		</p>
	</header>

	{#if post.cover}
		<!-- Full-bleed on phones. -->
		<figure
			class={[
				'-mx-5 mb-7 md:mx-auto md:max-w-article lg:mb-12',
				showToc && 'lg:max-w-article-wide'
			]}
		>
			<img
				src={post.cover.src}
				srcset={post.cover.srcset}
				sizes={showToc ? '(min-width: 1024px) 960px, 100vw' : '(min-width: 768px) 672px, 100vw'}
				alt={post.cover.alt}
				width={post.cover.width}
				height={post.cover.height}
				class="h-auto w-full"
			/>
			{#if post.cover.credit}
				{@const credit = post.cover.credit}
				<!-- eslint-disable svelte/no-navigation-without-resolve, svelte/no-useless-mustaches -- external credit links; explicit spaces, which Svelte trims at the start of an {#if} block -->
				<figcaption class="mt-2.5 px-5 meta md:px-0 [&_a]:link-quiet">
					{'Photo by '}{#if credit.href}<a href={credit.href} rel="noopener">{credit.name}</a
						>{:else}{credit.name}{/if}{#if credit.source}{' on '}{#if credit.sourceHref}<a
								href={credit.sourceHref}
								rel="noopener">{credit.source}</a
							>{:else}{credit.source}{/if}{/if}
				</figcaption>
				<!-- eslint-enable svelte/no-navigation-without-resolve, svelte/no-useless-mustaches -->
			{/if}
		</figure>
	{/if}

	<div
		class={[
			'mx-auto max-w-article',
			showToc && 'lg:grid lg:max-w-none lg:article-grid lg:justify-center'
		]}
	>
		<article class="min-w-0" bind:this={article}>
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

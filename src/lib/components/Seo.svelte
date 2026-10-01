<script lang="ts">
	// Per-page metadata: title, description, canonical URL, Open Graph and Twitter cards.
	// Canonical and og:url always use the production origin and drop the query string, so
	// /blog?q=… and preview hosts never compete with the real page.
	import { page } from '$app/state';
	import { CARD, cardUrl } from '$lib/share';
	import { site } from '$lib/site';

	interface Props {
		/** Page title; the site name is appended. Omit on the home page. */
		title?: string;
		description: string;
		/** Absolute URL of the original, e.g. a cross-post (Post seo.canonicalUrl). */
		canonical?: string | null;
		image?: {
			url: string;
			alt?: string | null;
			width?: number | null;
			height?: number | null;
		} | null;
		article?: { publishedTime: string; modifiedTime?: string; section?: string | null };
		/** Error pages and anything else search engines shouldn't list. */
		noindex?: boolean;
	}

	let { title, description, canonical, image: own, article, noindex = false }: Props = $props();

	// Without an image of its own, a page shares the site card (#62).
	const image = $derived(
		own ?? { url: cardUrl('/default'), alt: site.name, width: CARD.width, height: CARD.height }
	);

	const fullTitle = $derived(title ? `${title} · ${site.name}` : site.name);
	const url = $derived(canonical || new URL(page.url.pathname, site.url).href);
	const text = $derived(description.replace(/\s+/g, ' ').trim());
</script>

<svelte:head>
	<title>{fullTitle}</title>
	<meta name="description" content={text} />
	{#if noindex}
		<meta name="robots" content="noindex" />
	{:else}
		<link rel="canonical" href={url} />
	{/if}

	<meta property="og:site_name" content={site.name} />
	<meta property="og:title" content={title ?? site.name} />
	<meta property="og:description" content={text} />
	<meta property="og:url" content={url} />
	<meta property="og:type" content={article ? 'article' : 'website'} />
	<meta property="og:locale" content="en_CA" />
	{#if article}
		<meta property="article:published_time" content={article.publishedTime} />
		{#if article.modifiedTime}
			<meta property="article:modified_time" content={article.modifiedTime} />
		{/if}
		{#if article.section}
			<meta property="article:section" content={article.section} />
		{/if}
	{/if}
	{#if image}
		<meta property="og:image" content={image.url} />
		{#if image.alt}<meta property="og:image:alt" content={image.alt} />{/if}
		{#if image.width && image.height}
			<meta property="og:image:width" content={String(image.width)} />
			<meta property="og:image:height" content={String(image.height)} />
		{/if}
	{/if}

	<meta name="twitter:card" content={image ? 'summary_large_image' : 'summary'} />
	<meta name="twitter:title" content={title ?? site.name} />
	<meta name="twitter:description" content={text} />
	{#if image}
		<meta name="twitter:image" content={image.url} />
		{#if image.alt}<meta name="twitter:image:alt" content={image.alt} />{/if}
	{/if}
</svelte:head>

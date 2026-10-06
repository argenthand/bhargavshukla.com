<script lang="ts">
	// One aside (#18, F-asides-*): kind · date, optional title, the body styled by kind, quote
	// attribution, tags. In the stream the date links to the aside's own page; on that page it doesn't.
	import { resolve } from '$app/paths';
	import Prose from './Prose.svelte';
	import ReadCount from '$lib/components/ReadCount.svelte';
	import { kindLabel } from '../asides';
	import { formatDate, isoDay } from '../format';
	import { titleTransition } from '$lib/site';
	import type { RenderedAside } from '../types';

	let {
		aside,
		standalone = false,
		currentTag
	}: { aside: RenderedAside; standalone?: boolean; currentTag?: string } = $props();

	// "Author, " before a linked title; spaces kept in the string, since Svelte trims them in blocks.
	const byAuthor = $derived(
		aside.sourceAuthor && aside.sourceTitle ? `${aside.sourceAuthor}, ` : (aside.sourceAuthor ?? '')
	);

	const tagHref = (slug: string) => `${resolve('/asides')}?tag=${encodeURIComponent(slug)}`;
</script>

<div class="flex flex-col gap-3">
	<p class="flex flex-wrap items-center gap-2">
		<span class="label-accent">
			{kindLabel(aside.kind)}
		</span>
		<span aria-hidden="true" class="text-muted">·</span>
		{#snippet date()}
			<!-- In draft preview (#57) an unpublished aside says so instead of showing a date. -->
			{#if aside.draft}
				Not published
			{:else}
				<time datetime={isoDay(aside.publishedAt)}>{formatDate(aside.publishedAt)}</time>
			{/if}
		{/snippet}
		{#if standalone}
			<span class="meta">{@render date()}</span>
		{:else}
			<a href={resolve('/asides/[slug]', { slug: aside.slug })} class="meta link-quiet">
				{@render date()}
				{#if !aside.title}<span class="sr-only">: {aside.label}</span>{/if}
			</a>
		{/if}
		{#if aside.draft}<span class="draft-badge">Draft</span>{/if}
		{#if standalone && !aside.draft}
			<ReadCount path={resolve('/asides/[slug]', { slug: aside.slug })} track />
		{/if}
	</p>

	{#if aside.title}
		{#if standalone}
			<h1
				class="page-title"
				data-title-transition
				style:view-transition-name={titleTransition('aside', aside.slug)}
			>
				{aside.title}
			</h1>
		{:else}
			<h2
				class="list-title"
				data-title-transition
				style:view-transition-name={titleTransition('aside', aside.slug)}
			>
				<a href={resolve('/asides/[slug]', { slug: aside.slug })} class="hover:text-accent"
					>{aside.title}</a
				>
			</h2>
		{/if}
	{:else if standalone}
		<h1 class="sr-only">{aside.label}</h1>
	{/if}

	{#if aside.kind === 'quote'}
		<figure class="flex flex-col gap-2.5">
			<blockquote
				class={[
					// Same size as every other kind, here and on its own page (#66); italic sets it apart.
					'body-copy italic [&_p]:my-0 [&_p+p]:mt-3',
					// Curly quotes around the whole quote; the author writes only the words.
					'quote-marks'
				]}
			>
				<!-- eslint-disable-next-line svelte/no-at-html-tags -- the author's own Markdown from Strapi, rendered on the server -->
				{@html aside.html}
			</blockquote>
			{#if aside.sourceAuthor || aside.sourceTitle}
				<figcaption class="meta">
					— {byAuthor}{#if aside.sourceTitle}{#if aside.sourceUrl}<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- external source --><a
								href={aside.sourceUrl}
								rel="noopener"
								class="link-quiet"><cite>{aside.sourceTitle}</cite></a
							>{:else}<cite>{aside.sourceTitle}</cite>{/if}{/if}
				</figcaption>
			{/if}
		</figure>
	{:else}
		<!-- No extra margin around a code block that opens or closes the aside. -->
		<div class="[&_.code-block:first-child]:mt-0 [&_.code-block:last-child]:mb-0">
			<Prose html={aside.html} />
		</div>
	{/if}

	{#if aside.tags.length > 0}
		<ul class="flex flex-wrap gap-x-3.5">
			<li class="sr-only">Tags:</li>
			{#each aside.tags as tag (tag.slug)}
				<li>
					<!-- eslint-disable svelte/no-navigation-without-resolve -- resolve('/asides') plus a query -->
					<a
						href={tagHref(tag.slug)}
						aria-current={currentTag === tag.slug ? 'true' : undefined}
						class="tap-target meta link-quiet italic aria-[current=true]:text-ink aria-[current=true]:decoration-accent aria-[current=true]:decoration-2"
					>
						{tag.name}
					</a>
					<!-- eslint-enable svelte/no-navigation-without-resolve -->
				</li>
			{/each}
		</ul>
	{/if}
</div>

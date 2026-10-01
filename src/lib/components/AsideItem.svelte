<script lang="ts">
	// One aside (#18, F-asides-*): kind · date, optional title, the body styled by kind, quote
	// attribution, tags. In the stream the date links to the aside's own page; on that page it doesn't.
	import { resolve } from '$app/paths';
	import Prose from '$lib/components/Prose.svelte';
	import { kindLabel } from '$lib/asides';
	import { formatDate, isoDay } from '$lib/format';
	import type { RenderedAside } from '$lib/types/content';

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
		<span class="text-xs font-semibold tracking-widest text-red-700 uppercase dark:text-red-400">
			{kindLabel(aside.kind)}
		</span>
		<span aria-hidden="true" class="text-neutral-600 dark:text-neutral-400">·</span>
		{#if standalone}
			<time
				datetime={isoDay(aside.publishedAt)}
				class="text-sm text-neutral-600 dark:text-neutral-400"
			>
				{formatDate(aside.publishedAt)}
			</time>
		{:else}
			<a
				href={resolve('/asides/[slug]', { slug: aside.slug })}
				class="text-sm text-neutral-600 underline decoration-neutral-200 underline-offset-4 hover:text-neutral-900 dark:text-neutral-400 dark:decoration-neutral-800 dark:hover:text-neutral-100"
			>
				<time datetime={isoDay(aside.publishedAt)}>{formatDate(aside.publishedAt)}</time>
				{#if !aside.title}<span class="sr-only">: {aside.label}</span>{/if}
			</a>
		{/if}
	</p>

	{#if aside.title}
		{#if standalone}
			<h1 class="text-3xl/tight font-semibold text-balance">{aside.title}</h1>
		{:else}
			<h2 class="text-xl/snug font-semibold text-balance md:text-[22px]/snug">
				<a
					href={resolve('/asides/[slug]', { slug: aside.slug })}
					class="hover:text-red-700 dark:hover:text-red-400">{aside.title}</a
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
					'border-y border-neutral-200 py-4.5 italic dark:border-neutral-800 [&_p]:my-0 [&_p+p]:mt-3',
					// Curly quotes around the whole quote, as in the mockups; the author writes only the words.
					"[&>p:first-child]:before:content-['“'] [&>p:last-child]:after:content-['”']",
					standalone ? 'text-[26px]/[1.45]' : 'text-[22px]/[1.45]'
				]}
			>
				<!-- eslint-disable-next-line svelte/no-at-html-tags -- the author's own Markdown from Strapi, rendered on the server -->
				{@html aside.html}
			</blockquote>
			{#if aside.sourceAuthor || aside.sourceTitle}
				<figcaption class="text-[15px] text-neutral-600 dark:text-neutral-400">
					— {byAuthor}{#if aside.sourceTitle}{#if aside.sourceUrl}<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- external source --><a
								href={aside.sourceUrl}
								rel="noopener"
								class="underline decoration-neutral-200 underline-offset-4 hover:text-neutral-900 dark:decoration-neutral-800 dark:hover:text-neutral-100"
								><cite>{aside.sourceTitle}</cite></a
							>{:else}<cite>{aside.sourceTitle}</cite>{/if}{/if}
				</figcaption>
			{/if}
		</figure>
	{:else}
		<!-- No extra margin around a code block that opens or closes the aside. -->
		<div
			class={[
				'[&_.code-block:first-child]:mt-0 [&_.code-block:last-child]:mb-0',
				aside.kind === 'thought' && '[&_p]:text-xl/[1.7]'
			]}
		>
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
						class="inline-flex min-h-11 items-center text-[15px] text-neutral-600 italic underline decoration-neutral-200 underline-offset-[5px] hover:text-neutral-900 aria-[current=true]:text-neutral-900 aria-[current=true]:decoration-red-700 aria-[current=true]:decoration-2 dark:text-neutral-400 dark:decoration-neutral-800 dark:hover:text-neutral-100 dark:aria-[current=true]:text-neutral-100 dark:aria-[current=true]:decoration-red-400"
					>
						{tag.name}
					</a>
					<!-- eslint-enable svelte/no-navigation-without-resolve -->
				</li>
			{/each}
		</ul>
	{/if}
</div>

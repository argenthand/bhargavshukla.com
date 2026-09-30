<script lang="ts">
	// F-error-*: 404 and 5xx inside the site chrome. Static copy only: no data load, so it renders
	// even when Strapi is down. Never indexed.
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import Icon from '$lib/components/Icon.svelte';
	import Seo from '$lib/components/Seo.svelte';
	import { isLive } from '$lib/site';

	const notFound = $derived(page.status === 404);
	const label = $derived(notFound ? 'Not found' : 'Server error');

	const linkClass =
		'inline-flex min-h-11 items-center gap-1.5 text-lg text-red-700 underline decoration-1 underline-offset-4 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300';
</script>

<Seo
	title={notFound ? 'Not found' : 'Something broke'}
	description={notFound ? "This page isn't here." : 'Something broke on the server.'}
	noindex
/>

<div class="mx-auto max-w-3xl px-5 md:px-8">
	<section
		aria-labelledby="error-title"
		class="flex max-w-140 flex-col gap-4 py-14 md:pt-24 md:pb-30"
	>
		<span class="text-xs font-semibold tracking-widest text-red-700 uppercase dark:text-red-400">
			{page.status} · {label}
		</span>
		<h1
			id="error-title"
			class="text-4xl/[1.1] font-medium tracking-tight text-balance md:text-5xl/[1.1]"
		>
			{notFound ? "This page isn't here" : 'Something broke on my end'}
		</h1>
		<p class="text-lg/[1.7] text-neutral-700 dark:text-neutral-300">
			{#if notFound}
				The link may be old, or the page may have moved.
				{isLive('/blog')
					? 'Try the writing index, or start from the home page.'
					: 'Start from the home page.'}
			{:else}
				It's not you. Give it a minute and try again; if it keeps happening, the home page should
				still load.
			{/if}
		</p>
		<div
			class="mt-2 flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-neutral-200 pt-2 dark:border-neutral-800"
		>
			{#if notFound}
				{#if isLive('/blog')}
					<a href={resolve('/blog')} class={linkClass}>
						Browse writing <Icon name="arrow-right" />
					</a>
				{/if}
			{:else}
				<!-- A plain link to the same URL: a fresh request, which works without JavaScript too. -->
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- the current URL, reloaded as is -->
				<a href={page.url.href} data-sveltekit-reload class={linkClass}>
					Try again <Icon name="arrow-right" />
				</a>
			{/if}
			<a href={resolve('/')} class={linkClass}>Go home <Icon name="arrow-right" /></a>
		</div>
	</section>
</div>

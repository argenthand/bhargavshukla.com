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
</script>

<Seo
	title={notFound ? 'Not found' : 'Something broke'}
	description={notFound ? "This page isn't here." : 'Something broke on the server.'}
	noindex
/>

<div class="page max-w-3xl">
	<section aria-labelledby="error-title" class="flex max-w-140 flex-col gap-4">
		<span class="label-accent">
			{page.status} · {label}
		</span>
		<h1 id="error-title" class="page-title">
			{notFound ? "This page isn't here" : 'Something broke on my end'}
		</h1>
		<p class="body-copy">
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
					<a href={resolve('/blog')} class="link-cta">
						Browse writing <Icon name="arrow-right" />
					</a>
				{/if}
			{:else}
				<!-- A plain link to the same URL: a fresh request, which works without JavaScript too. -->
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- the current URL, reloaded as is -->
				<a href={page.url.href} data-sveltekit-reload class="link-cta">
					Try again <Icon name="arrow-right" />
				</a>
			{/if}
			<a href={resolve('/')} class="link-cta">Go home <Icon name="arrow-right" /></a>
		</div>
	</section>
</div>

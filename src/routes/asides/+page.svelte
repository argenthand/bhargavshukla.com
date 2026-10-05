<script lang="ts">
	// The Asides stream (F-asides-*): every aside in full, newest first. Filters (?kind=, ?tag=) and
	// paging (?page=) come from the URL, so links, the back button and the no-JS form all work.
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import AsideItem from '$lib/components/AsideItem.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import Seo from '$lib/components/Seo.svelte';
	import { isKind, KINDS, PAGE_SIZE } from '$lib/asides';
	import { motionMs } from '$lib/motion';
	import { cubicOut } from 'svelte/easing';
	import { flip } from 'svelte/animate';
	import { fade } from 'svelte/transition';

	let { data } = $props();

	const STANDFIRST = 'Short things worth keeping: code, quotes, tips.';

	const params = $derived(page.url.searchParams);
	const kind = $derived.by(() => {
		const k = params.get('kind');
		return isKind(k) ? k : '';
	});
	const tag = $derived(params.get('tag') ?? '');
	const pageNo = $derived(Math.max(1, Number(params.get('page')) || 1));

	const filtered = $derived(
		data.asides.filter(
			(a) => (!kind || a.kind === kind) && (!tag || a.tags.some((t) => t.slug === tag))
		)
	);
	const pageCount = $derived(Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)));
	const shown = $derived(filtered.slice((pageNo - 1) * PAGE_SIZE, pageNo * PAGE_SIZE));
	const tagName = $derived(
		data.asides.flatMap((a) => a.tags).find((t) => t.slug === tag)?.name ?? tag
	);
	const kindPlural = $derived(KINDS.find((k) => k.value === kind)?.plural);

	/** /asides with these filters; page 1 and empty values are left out. */
	function href(next: { kind?: string; tag?: string; page?: number }) {
		const pairs: [string, string | number | undefined][] = [
			['kind', next.kind ?? kind],
			['tag', next.tag ?? tag],
			['page', next.page && next.page > 1 ? next.page : undefined]
		];
		const search = pairs
			.filter(([, v]) => v)
			.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
			.join('&');
		return `${resolve('/asides')}${search ? `?${search}` : ''}`;
	}

	function setKind(value: string) {
		// Changing a filter starts again from page 1; no reload of the data.
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- href() starts from resolve('/asides')
		goto(href({ kind: value }), { replaceState: true, noScroll: true, keepFocus: true });
	}
</script>

<Seo title="Asides" description={STANDFIRST} />

<div class="page flex max-w-3xl flex-col gap-7">
	<div>
		<h1 class="page-title">Asides</h1>
		<p class="mt-2 standfirst">{STANDFIRST}</p>
	</div>

	<!-- Without JavaScript this is a plain GET form; with it, filtering is instant. -->
	<form method="get" onsubmit={(event) => event.preventDefault()}>
		{#if tag}<input type="hidden" name="tag" value={tag} />{/if}

		<!-- Phone: a native select. -->
		<div class="flex flex-col gap-1 md:hidden">
			<label for="kind" class="label-muted"> Kind </label>
			<div class="relative flex items-center">
				<select
					id="kind"
					name="kind"
					value={kind}
					onchange={(event) => setKind(event.currentTarget.value)}
					class="select-field"
				>
					<option value="">All</option>
					{#each KINDS as k (k.value)}
						<option value={k.value}>{k.plural}</option>
					{/each}
				</select>
				<Icon
					name="chevron-down"
					size={18}
					class="pointer-events-none absolute right-4 text-muted"
				/>
			</div>
		</div>

		<!-- md+: underlined filter links; they replace the history entry and keep the scroll position. -->
		<nav aria-label="Filter by kind" class="-ml-2.5 hidden flex-wrap gap-1 md:flex">
			{#each [{ value: '', plural: 'All' }, ...KINDS] as k (k.value)}
				<!-- eslint-disable svelte/no-navigation-without-resolve -- href() starts from resolve('/asides') -->
				<a
					href={href({ kind: k.value })}
					aria-current={kind === k.value ? 'true' : undefined}
					data-sveltekit-replacestate
					data-sveltekit-noscroll
					data-sveltekit-keepfocus
					class="filter-button"
				>
					{k.plural}
				</a>
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
			{/each}
		</nav>
	</form>

	{#if tag}
		<div role="status" class="flex min-h-13 items-center justify-between gap-3 surface pr-2 pl-4">
			<span class="body-copy">
				{#if filtered.length > 0}
					{filtered.length}
					{kindPlural?.toLowerCase() ?? (filtered.length === 1 ? 'aside' : 'asides')}
				{:else}
					{kindPlural ?? 'Asides'}
				{/if}
				tagged
				<em class="font-semibold text-ink not-italic">{tagName}</em>
			</span>
			<!-- eslint-disable svelte/no-navigation-without-resolve -- href() starts from resolve('/asides') -->
			<a href={href({ tag: '' })} class="link-cta px-2">
				<Icon name="close" />Clear<span class="sr-only"> tag filter</span>
			</a>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
		</div>
	{/if}

	{#if shown.length === 0}
		<div class="flex flex-col gap-2" role="status">
			<p class="body-copy">
				{data.degraded
					? "Asides can't load right now. Try again in a minute."
					: 'Nothing here yet.'}
			</p>
			{#if data.asides.length > 0}
				<a href={resolve('/asides')} class="link-cta self-start"> See all asides </a>
			{/if}
		</div>
	{:else}
		<!-- Filter changes: asides that stay slide into place, new ones fade in (#61). -->
		<ol class="flex flex-col gap-12">
			{#each shown as aside (aside.slug)}
				<li
					animate:flip={{ duration: motionMs(), easing: cubicOut }}
					in:fade={{ duration: motionMs(), easing: cubicOut }}
				>
					<article><AsideItem {aside} currentTag={tag} /></article>
				</li>
			{/each}
		</ol>

		{#if pageCount > 1}
			<nav aria-label="Pages" class="flex justify-between">
				{#if pageNo > 1}
					<!-- eslint-disable svelte/no-navigation-without-resolve -- href() starts from resolve('/asides') -->
					<a href={href({ page: pageNo - 1 })} class="link-cta">
						<Icon name="arrow-left" />Newer asides
					</a>
					<!-- eslint-enable svelte/no-navigation-without-resolve -->
				{:else}
					<span></span>
				{/if}
				{#if pageNo < pageCount}
					<!-- eslint-disable svelte/no-navigation-without-resolve -- href() starts from resolve('/asides') -->
					<a href={href({ page: pageNo + 1 })} class="link-cta">
						Older asides<Icon name="arrow-right" />
					</a>
					<!-- eslint-enable svelte/no-navigation-without-resolve -->
				{/if}
			</nav>
		{/if}
	{/if}
</div>

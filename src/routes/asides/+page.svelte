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

<div class="mx-auto flex max-w-3xl flex-col gap-7 px-5 pt-8 pb-14 md:px-8 md:pt-12">
	<div>
		<h1 class="text-4xl/[1.1] font-medium tracking-tight">Asides</h1>
		<p class="mt-2 text-lg text-neutral-600 italic dark:text-neutral-400">{STANDFIRST}</p>
	</div>

	<!-- Without JavaScript this is a plain GET form; with it, filtering is instant. -->
	<form method="get" onsubmit={(event) => event.preventDefault()}>
		{#if tag}<input type="hidden" name="tag" value={tag} />{/if}

		<!-- Phone: a native select. -->
		<div class="flex flex-col gap-1 md:hidden">
			<label
				for="kind"
				class="text-xs font-semibold tracking-widest text-neutral-600 uppercase dark:text-neutral-400"
			>
				Kind
			</label>
			<div class="relative flex items-center">
				<select
					id="kind"
					name="kind"
					value={kind}
					onchange={(event) => setKind(event.currentTarget.value)}
					class="h-11 w-full appearance-none rounded-none border-0 border-b border-neutral-900 bg-transparent bg-none py-0 pr-8 pl-0 text-lg focus:border-b-2 focus:border-red-700 focus:ring-0 dark:border-neutral-100 dark:focus:border-red-400"
				>
					<option value="">All</option>
					{#each KINDS as k (k.value)}
						<option value={k.value}>{k.plural}</option>
					{/each}
				</select>
				<Icon
					name="chevron-down"
					size={18}
					class="pointer-events-none absolute right-0 text-neutral-600 dark:text-neutral-400"
				/>
			</div>
		</div>

		<!-- md+: underlined filter buttons. Without JavaScript they submit the form. -->
		<div role="group" aria-label="Filter by kind" class="-ml-2.5 hidden flex-wrap gap-1 md:flex">
			{#each [{ value: '', plural: 'All' }, ...KINDS] as k (k.value)}
				<button
					type="submit"
					name="kind"
					value={k.value}
					aria-pressed={kind === k.value}
					onclick={() => setKind(k.value)}
					class="min-h-11 px-2.5 text-lg whitespace-nowrap text-neutral-600 aria-pressed:text-neutral-900 aria-pressed:underline aria-pressed:decoration-red-700 aria-pressed:decoration-2 aria-pressed:underline-offset-8 dark:text-neutral-400 dark:aria-pressed:text-neutral-100 dark:aria-pressed:decoration-red-400"
				>
					{k.plural}
				</button>
			{/each}
		</div>
	</form>

	{#if tag}
		<div
			role="status"
			class="flex min-h-13 items-center justify-between gap-3 border border-neutral-200 bg-neutral-50 pr-2 pl-4 dark:border-neutral-800 dark:bg-neutral-900"
		>
			<span class="text-[17px] text-neutral-700 dark:text-neutral-300">
				{#if filtered.length > 0}
					{filtered.length}
					{kindPlural?.toLowerCase() ?? (filtered.length === 1 ? 'aside' : 'asides')}
				{:else}
					{kindPlural ?? 'Asides'}
				{/if}
				tagged
				<em class="font-semibold text-neutral-900 not-italic dark:text-neutral-100">{tagName}</em>
			</span>
			<!-- eslint-disable svelte/no-navigation-without-resolve -- href() starts from resolve('/asides') -->
			<a
				href={href({ tag: '' })}
				class="inline-flex min-h-11 items-center gap-1.5 px-2 text-red-700 dark:text-red-400"
			>
				<Icon name="close" />Clear<span class="sr-only"> tag filter</span>
			</a>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
		</div>
	{/if}

	{#if shown.length === 0}
		<div
			class="flex flex-col gap-2 border-t-2 border-neutral-900 pt-6 dark:border-neutral-100"
			role="status"
		>
			<p class="text-lg text-neutral-700 dark:text-neutral-300">Nothing here yet.</p>
			{#if data.asides.length > 0}
				<a
					href={resolve('/asides')}
					class="inline-flex min-h-11 items-center self-start font-semibold text-red-700 dark:text-red-400"
				>
					See all asides
				</a>
			{/if}
		</div>
	{:else}
		<ol class="border-t-2 border-neutral-900 dark:border-neutral-100">
			{#each shown as aside (aside.slug)}
				<li class="border-b border-neutral-200 pt-7 pb-2.5 last:border-b-0 dark:border-neutral-800">
					<article><AsideItem {aside} currentTag={tag} /></article>
				</li>
			{/each}
		</ol>

		{#if pageCount > 1}
			<nav
				aria-label="Pages"
				class="flex justify-between border-t border-neutral-200 pt-3 dark:border-neutral-800"
			>
				{#if pageNo > 1}
					<!-- eslint-disable svelte/no-navigation-without-resolve -- href() starts from resolve('/asides') -->
					<a
						href={href({ page: pageNo - 1 })}
						class="inline-flex min-h-11 items-center gap-2 font-semibold text-red-700 dark:text-red-400"
					>
						<Icon name="arrow-left" />Newer asides
					</a>
					<!-- eslint-enable svelte/no-navigation-without-resolve -->
				{:else}
					<span></span>
				{/if}
				{#if pageNo < pageCount}
					<!-- eslint-disable svelte/no-navigation-without-resolve -- href() starts from resolve('/asides') -->
					<a
						href={href({ page: pageNo + 1 })}
						class="inline-flex min-h-11 items-center gap-2 font-semibold text-red-700 dark:text-red-400"
					>
						Older asides<Icon name="arrow-right" />
					</a>
					<!-- eslint-enable svelte/no-navigation-without-resolve -->
				{/if}
			</nav>
		{/if}
	{/if}
</div>

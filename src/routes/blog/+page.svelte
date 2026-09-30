<script lang="ts">
	import { resolve } from '$app/paths';
	import { replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import Icon from '$lib/components/Icon.svelte';
	import PostMeta from '$lib/components/PostMeta.svelte';
	import Seo from '$lib/components/Seo.svelte';
	import { shownDate, yearOf } from '$lib/format';
	import { site } from '$lib/site';

	let { data } = $props();

	// Search and filter start from ?q=&cat=, so links and the no-JS form work too.
	let q = $state(page.url.searchParams.get('q') ?? '');
	let cat = $state(page.url.searchParams.get('cat') ?? '');

	const filtered = $derived.by(() => {
		const needle = q.trim().toLowerCase();
		return data.posts.filter(
			(post) =>
				(!needle || post.title.toLowerCase().includes(needle)) &&
				(!cat || post.category?.slug === cat)
		);
	});

	const years = $derived.by(() => {
		const groups: { year: number; posts: typeof filtered }[] = [];
		for (const post of filtered) {
			const year = yearOf(shownDate(post));
			if (groups.at(-1)?.year !== year) groups.push({ year, posts: [] });
			groups.at(-1)?.posts.push(post);
		}
		return groups;
	});

	// Mirror the filters into the URL without a navigation (no reload of the data).
	$effect(() => {
		const url = new URL(page.url);
		for (const [key, value] of [
			['q', q.trim()],
			['cat', cat]
		]) {
			if (value) url.searchParams.set(key, value);
			else url.searchParams.delete(key);
		}
		if (url.search !== page.url.search)
			// eslint-disable-next-line svelte/no-navigation-without-resolve -- same resolved path, only the query changes
			replaceState(`${resolve('/blog')}${url.search}`, page.state);
	});

	function clear() {
		q = '';
		cat = '';
	}
</script>

<Seo title="Writing" description={site.description} />

<div class="mx-auto flex max-w-3xl flex-col gap-7 px-5 pt-8 pb-12 md:px-8 md:pt-12">
	<div>
		<h1 class="text-4xl/[1.1] font-medium tracking-tight">Writing</h1>
		<p class="mt-2 text-lg text-neutral-600 italic dark:text-neutral-400">
			{site.description}
		</p>
	</div>

	<!-- Without JavaScript this is a plain GET form; with it, filtering is instant. -->
	<form
		method="get"
		class="flex flex-col gap-5 md:gap-4"
		onsubmit={(event) => event.preventDefault()}
	>
		<div class="flex flex-col gap-1">
			<label
				for="q"
				class="text-xs font-semibold tracking-widest text-neutral-600 uppercase dark:text-neutral-400"
			>
				Search titles
			</label>
			<div
				class="flex items-center gap-2 border-b border-neutral-900 focus-within:border-b-2 focus-within:border-red-700 dark:border-neutral-100 dark:focus-within:border-red-400"
			>
				<Icon name="search" size={18} class="text-neutral-600 dark:text-neutral-400" />
				<input
					id="q"
					name="q"
					type="search"
					placeholder="e.g. delegation"
					bind:value={q}
					class="h-11 min-w-0 flex-1 border-0 bg-transparent p-0 text-lg placeholder:text-neutral-500 focus:ring-0 focus:outline-none"
				/>
			</div>
		</div>

		<!-- Phone: a native select. -->
		<div class="flex flex-col gap-1 md:hidden">
			<label
				for="cat"
				class="text-xs font-semibold tracking-widest text-neutral-600 uppercase dark:text-neutral-400"
			>
				Category
			</label>
			<div class="relative flex items-center">
				<select
					id="cat"
					name="cat"
					bind:value={cat}
					class="h-11 w-full appearance-none rounded-none border-0 border-b border-neutral-900 bg-transparent bg-none py-0 pr-8 pl-0 text-lg focus:border-b-2 focus:border-red-700 focus:ring-0 dark:border-neutral-100 dark:focus:border-red-400"
				>
					<option value="">All</option>
					{#each data.categories as category (category.slug)}
						<option value={category.slug}>{category.name}</option>
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
		<div
			role="group"
			aria-label="Filter by category"
			class="-ml-2.5 hidden flex-wrap gap-1 md:flex"
		>
			{#each [{ slug: '', name: 'All' }, ...data.categories] as category (category.slug)}
				<button
					type="submit"
					name="cat"
					value={category.slug}
					aria-pressed={cat === category.slug}
					onclick={() => (cat = category.slug)}
					class="min-h-11 px-2.5 text-lg whitespace-nowrap text-neutral-600 aria-pressed:text-neutral-900 aria-pressed:underline aria-pressed:decoration-red-700 aria-pressed:decoration-2 aria-pressed:underline-offset-8 dark:text-neutral-400 dark:aria-pressed:text-neutral-100 dark:aria-pressed:decoration-red-400"
				>
					{category.name}
				</button>
			{/each}
		</div>
	</form>

	{#if filtered.length === 0}
		<div class="border-t-2 border-neutral-900 pt-6 dark:border-neutral-100" role="status">
			<p class="text-lg text-neutral-700 dark:text-neutral-300">
				{data.posts.length === 0 ? 'Nothing published yet.' : 'No posts match those filters.'}
			</p>
			{#if data.posts.length > 0}
				<button
					type="button"
					onclick={clear}
					class="mt-2 inline-flex min-h-11 items-center font-semibold text-red-700 dark:text-red-400"
				>
					Clear filters
				</button>
			{/if}
		</div>
	{:else}
		<div>
			{#each years as group (group.year)}
				<h2
					class="mt-7 border-b-2 border-neutral-900 pb-1.5 text-xs font-semibold tracking-widest first:mt-0 dark:border-neutral-100"
				>
					{group.year}
				</h2>
				<ul>
					{#each group.posts as post (post.slug)}
						<li class="border-b border-neutral-200 dark:border-neutral-800">
							<a
								href={resolve('/blog/[slug]', { slug: post.slug })}
								class="group flex flex-col gap-1.5 py-4.5"
							>
								<span
									class="text-xl/snug font-semibold text-balance group-hover:text-red-700 md:text-[22px]/snug dark:group-hover:text-red-400"
								>
									{post.title}
								</span>
								<PostMeta {post} />
							</a>
						</li>
					{/each}
				</ul>
			{/each}
		</div>
	{/if}
</div>

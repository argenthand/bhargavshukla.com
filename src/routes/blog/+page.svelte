<script lang="ts">
	import { resolve } from '$app/paths';
	import { replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import { Icon, Seo, motionMs, titleTransition, site } from '$lib/site';
	import { PostMeta, shownDate, yearOf } from '$lib/content';
	import { cubicOut } from 'svelte/easing';
	import { flip } from 'svelte/animate';
	import { fade } from 'svelte/transition';

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

	/** /blog with this category and the current search: the filter link's target without JavaScript. */
	function catHref(slug: string) {
		const params = [q.trim() && `q=${encodeURIComponent(q.trim())}`, slug && `cat=${slug}`]
			.filter(Boolean)
			.join('&');
		return `${resolve('/blog')}${params ? `?${params}` : ''}`;
	}

	function clear() {
		q = '';
		cat = '';
	}
</script>

<Seo title="Writing" description={site.description} />

<div class="page flex max-w-3xl flex-col gap-7">
	<div>
		<h1 class="page-title">Writing</h1>
		<p class="mt-2 standfirst">{site.description}</p>
	</div>

	<!-- Without JavaScript this is a plain GET form; with it, filtering is instant. -->
	<form
		method="get"
		class="flex flex-col gap-5 md:gap-4"
		onsubmit={(event) => event.preventDefault()}
	>
		<div class="flex flex-col gap-1">
			<label for="q" class="label-muted"> Search titles </label>
			<div class="field">
				<Icon name="search" size={18} class="text-muted" />
				<input
					id="q"
					name="q"
					type="search"
					placeholder="e.g. delegation"
					bind:value={q}
					class="h-11 min-w-0 flex-1 border-0 bg-transparent p-0 text-lg placeholder:text-faint focus:ring-0 focus:outline-none"
				/>
			</div>
		</div>

		<!-- Phone: a native select. -->
		<div class="flex flex-col gap-1 md:hidden">
			<label for="cat" class="label-muted"> Category </label>
			<div class="relative flex items-center">
				<select id="cat" name="cat" bind:value={cat} class="select-field">
					<option value="">All</option>
					{#each data.categories as category (category.slug)}
						<option value={category.slug}>{category.name}</option>
					{/each}
				</select>
				<Icon
					name="chevron-down"
					size={18}
					class="pointer-events-none absolute right-4 text-muted"
				/>
			</div>
		</div>

		<!-- md+: underlined filter links. With JavaScript they filter in place; without, they load the URL. -->
		<nav aria-label="Filter by category" class="-ml-2.5 hidden flex-wrap gap-1 md:flex">
			{#each [{ slug: '', name: 'All' }, ...data.categories] as category (category.slug)}
				<!-- eslint-disable svelte/no-navigation-without-resolve -- catHref() starts from resolve('/blog') -->
				<a
					href={catHref(category.slug)}
					aria-current={cat === category.slug ? 'true' : undefined}
					onclick={(event) => {
						event.preventDefault();
						cat = category.slug;
					}}
					class="filter-button"
				>
					{category.name}
				</a>
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
			{/each}
		</nav>
	</form>

	{#if filtered.length === 0}
		<div role="status">
			<p class="body-copy">
				{data.degraded
					? "Posts can't load right now. Try again in a minute."
					: data.posts.length === 0
						? 'Nothing published yet.'
						: 'No posts match those filters.'}
			</p>
			{#if data.posts.length > 0}
				<button type="button" onclick={clear} class="mt-2 link-cta"> Clear filters </button>
			{/if}
		</div>
	{:else}
		<div>
			<!-- When the filters change, rows that stay slide into place and new ones fade in (#61). Rows
			     that go leave at once, so the rest can move straight away. -->
			{#each years as group (group.year)}
				<div
					class="mt-10 flex flex-col gap-1 first:mt-0"
					in:fade={{ duration: motionMs(), easing: cubicOut }}
				>
					<h2 class="section-heading">
						{group.year}
					</h2>
					<ul>
						{#each group.posts as post (post.slug)}
							<li
								animate:flip={{ duration: motionMs(), easing: cubicOut }}
								in:fade={{ duration: motionMs(), easing: cubicOut }}
							>
								<a href={resolve('/blog/[slug]', { slug: post.slug })} class="group list-entry">
									<span
										class={[
											'list-title group-hover:text-accent',
											// A draft's title is muted, as in the preview-mode mockup (#57).
											post.draft && 'text-muted'
										]}
										data-title-transition
										style:view-transition-name={titleTransition('post', post.slug)}
									>
										{post.title}
									</span>
									<PostMeta {post} />
								</a>
							</li>
						{/each}
					</ul>
				</div>
			{/each}
		</div>
	{/if}
</div>

<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import Icon from '$lib/components/Icon.svelte';
	import { nav, site } from '$lib/site';

	let { children } = $props();

	// A section stays current on its detail pages (/blog/<slug> keeps Writing active).
	// Error pages have no current section.
	const current = (href: string) =>
		!page.error && (page.url.pathname === href || page.url.pathname.startsWith(`${href}/`))
			? 'page'
			: undefined;

	const year = new Date().getFullYear();

	// On the home page the intro's h1 is the name, so the header leaves it out until that heading
	// scrolls under the sticky phone bar, then fades it in (#59). The desktop header isn't sticky,
	// so there it simply stays out. `js:` keeps it visible without JavaScript.
	const isHome = $derived(page.route.id === '/' && !page.error);
	let introInView = $state(true);
	$effect(() => {
		if (!isHome) return;
		const heading = document.getElementById('intro-name');
		if (!heading) return;
		const observer = new IntersectionObserver(
			([entry]) => (introInView = entry.isIntersecting),
			{ rootMargin: '-56px 0px 0px 0px' } // the sticky bar's height (h-14)
		);
		observer.observe(heading);
		return () => {
			observer.disconnect();
			introInView = true;
		};
	});
	const hideName = $derived(isHome && introInView);
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		rel="stylesheet"
		href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&family=JetBrains+Mono:wght@400;500&display=swap"
	/>
</svelte:head>

<!-- Bottom padding keeps the footer clear of the fixed tab bar below md. -->
<div
	class={[
		'flex min-h-dvh flex-col print:pb-0',
		nav.length > 0 && 'pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0'
	]}
>
	<!-- One header: the slim sticky top bar below md, the full header with nav from md. -->
	<header
		class="sticky top-0 z-10 border-b border-neutral-200 bg-white md:static dark:border-neutral-800 dark:bg-neutral-950 print:hidden"
	>
		<div class="mx-auto flex h-14 max-w-5xl items-center justify-between px-5 md:h-20 md:px-8">
			<a
				href={resolve('/')}
				class={[
					'tap-target text-xl font-semibold tracking-tight transition-fade duration-200 motion-reduce:transition-none md:text-2xl',
					hideName && 'js:invisible js:opacity-0'
				]}
			>
				{site.name}
			</a>
			{#if nav.length > 0}
				<nav aria-label="Primary" class="hidden items-center gap-2 md:flex">
					{#each nav as item (item.href)}
						<!-- eslint-disable svelte/no-navigation-without-resolve -- nav hrefs are plain strings from site.ts; resolve() needs route literals -->
						<a
							href={item.href}
							aria-current={current(item.href)}
							class="tap-target px-3 text-lg text-neutral-600 hover:text-neutral-900 aria-[current=page]:text-neutral-900 aria-[current=page]:underline aria-[current=page]:decoration-red-700 aria-[current=page]:decoration-2 aria-[current=page]:underline-offset-8 dark:text-neutral-400 dark:hover:text-neutral-100 dark:aria-[current=page]:text-neutral-100 dark:aria-[current=page]:decoration-red-400"
						>
							{item.label}
						</a>
						<!-- eslint-enable svelte/no-navigation-without-resolve -->
					{/each}
				</nav>
			{/if}
		</div>
	</header>

	<main class="flex-1">
		{@render children()}
	</main>

	<footer class="border-t border-neutral-200 dark:border-neutral-800 print:hidden">
		<div
			class="mx-auto flex min-h-19 max-w-5xl items-center justify-between px-5 py-4 meta md:px-8"
		>
			<span>© {year} {site.name}</span>
		</div>
	</footer>
</div>

<!-- The same Primary nav as a bottom tab bar below md; the header's copy is hidden there. -->
{#if nav.length > 0}
	<nav
		aria-label="Primary"
		class="fixed inset-x-0 bottom-0 z-20 grid auto-cols-fr grid-flow-col border-t border-neutral-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden dark:border-neutral-800 dark:bg-neutral-950 print:hidden"
	>
		{#each nav as item (item.href)}
			<!-- eslint-disable svelte/no-navigation-without-resolve -- nav hrefs are plain strings from site.ts; resolve() needs route literals -->
			<a
				href={item.href}
				aria-current={current(item.href)}
				class="-mt-px flex min-h-14 flex-col items-center justify-center gap-1 border-t-2 border-transparent text-xs tracking-wide text-neutral-600 aria-[current=page]:border-red-700 aria-[current=page]:font-semibold aria-[current=page]:text-red-700 dark:text-neutral-400 dark:aria-[current=page]:border-red-400 dark:aria-[current=page]:text-red-400"
			>
				<Icon name={item.icon} size={22} />
				<span>{item.label}</span>
			</a>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
		{/each}
	</nav>
{/if}

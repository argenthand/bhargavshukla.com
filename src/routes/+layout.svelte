<script lang="ts">
	import './layout.css';
	import { onMount } from 'svelte';
	import { onNavigate } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import Icon from '$lib/components/Icon.svelte';
	import Shortcuts from '$lib/components/Shortcuts.svelte';
	import PalettePicker from '$lib/components/PalettePicker.svelte';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import { consoleNote } from '$lib/easter-eggs';
	import { nav, site } from '$lib/site';

	let { children, data } = $props();

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

	// Page transitions (#60): a short cross-fade between pages. A title moves only between a list and
	// its own page (Writing → post, Asides → aside, and back); between two lists it just fades.
	// Skipped where the browser has no View Transitions, with reduced motion, and for query-only
	// changes (filters).
	const isDetail = (route?: string | null) =>
		route === '/blog/[slug]' || route === '/asides/[slug]';
	onNavigate((navigation) => {
		if (!document.startViewTransition) return;
		if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		if (navigation.from?.url.pathname === navigation.to?.url.pathname) return;
		const root = document.documentElement;
		const moveTitles = isDetail(navigation.from?.route.id) !== isDetail(navigation.to?.route.id);
		root.toggleAttribute('data-plain-transition', !moveTitles);
		return new Promise((done) => {
			const transition = document.startViewTransition(async () => {
				done();
				await navigation.complete;
			});
			transition.finished.finally(() => root.removeAttribute('data-plain-transition'));
		});
	});

	// A note for whoever opens DevTools (#63).
	onMount(consoleNote);

	// The phone tab bar's marker slides to the current tab (#60).
	const currentTab = $derived(nav.findIndex((item) => current(item.href)));
</script>

<svelte:head>
	<!-- Favicon (#89): the ICO for browsers and feed readers that skip SVG, then the SVG; iOS home screens. -->
	<link rel="icon" href="/favicon.ico" sizes="32x32" />
	<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
	<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
	<!-- Feed autodiscovery (#56): absolute, like canonical URLs. -->
	<link rel="alternate" type="application/rss+xml" title={site.name} href="{site.url}/rss.xml" />
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
		'flex min-h-dvh flex-col print:block print:pb-0',
		nav.length > 0 && 'pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0'
	]}
>
	<!-- One header: the slim sticky top bar below md, the full header with nav from md. -->
	<!-- Named, so page transitions keep the header still instead of fading it with the page. -->
	<header
		style:view-transition-name="site-header"
		class="sticky top-0 z-10 bar-top md:static md:bg-transparent md:shadow-none print:hidden"
	>
		<div class="mx-auto flex h-14 max-w-5xl items-center justify-between px-5 md:h-20 md:px-8">
			<a
				href={resolve('/')}
				class={[
					'tap-target text-xl font-semibold tracking-tight transition-fade duration-(--duration-motion) hover:text-accent motion-reduce:transition-none md:text-2xl',
					hideName && 'js:invisible js:opacity-0'
				]}
			>
				{site.name}
			</a>
			<div class="flex items-center gap-4">
				{#if nav.length > 0}
					<nav aria-label="Primary" class="hidden items-center gap-2 md:flex">
						{#each nav as item (item.href)}
							<!-- eslint-disable svelte/no-navigation-without-resolve -- nav hrefs are plain strings from site.ts; resolve() needs route literals -->
							<a
								href={item.href}
								aria-current={current(item.href)}
								class="tap-target px-3 text-lg text-muted hover:text-ink aria-[current=page]:text-ink aria-[current=page]:underline aria-[current=page]:decoration-accent aria-[current=page]:decoration-2 aria-[current=page]:underline-offset-8"
							>
								{item.label}
							</a>
							<!-- eslint-enable svelte/no-navigation-without-resolve -->
						{/each}
					</nav>
				{/if}
				<!-- Colour palette (#81) and Light / Dark / System (#80). -->
				<div class="flex items-center gap-2">
					<PalettePicker />
					<ThemeToggle />
				</div>
			</div>
		</div>
	</header>

	{#if data.preview}
		<!-- Draft preview (#57, F-writing-* preview mode): only for whoever opened it from Strapi. -->
		<div role="status" class="bg-panel meta print:hidden">
			<div class="mx-auto flex max-w-5xl items-center gap-2 px-5 md:px-8">
				<span aria-hidden="true" class="size-2 shrink-0 rounded-full border border-current"></span>
				<span class="py-2.5">Preview mode: drafts are visible to you only</span>
				<!-- A server route: reload so the cookie is cleared before the page loads again. -->
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- resolve() can't take a query string -->
				<a
					href="{resolve('/api/preview/exit')}?path={encodeURIComponent(
						page.url.pathname + page.url.search
					)}"
					data-sveltekit-reload
					class="ml-auto tap-target link-quiet"
				>
					Exit<span class="sr-only"> preview mode</span>
				</a>
			</div>
		</div>
	{/if}

	<main class="flex-1">
		{@render children()}
	</main>

	<footer class="print:hidden">
		<div
			class="mx-auto flex min-h-19 max-w-5xl items-center justify-between px-5 py-4 meta md:px-8"
		>
			<span>© {year} {site.name}</span>
			<!-- A server route, not a page: reload so the browser (or a feed reader) opens the XML. -->
			<a href={resolve('/rss.xml')} data-sveltekit-reload class="tap-target gap-1.5 link-quiet">
				<Icon name="rss" />RSS
			</a>
		</div>
	</footer>
</div>

<Shortcuts />

<!-- The same Primary nav as a bottom tab bar below md; the header's copy is hidden there. -->
{#if nav.length > 0}
	<nav
		aria-label="Primary"
		style:view-transition-name="site-tabs"
		class="fixed inset-x-0 bottom-0 z-20 grid auto-cols-fr grid-flow-col bar-bottom pb-[env(safe-area-inset-bottom)] md:hidden print:hidden"
	>
		<!-- One marker for the current tab; it slides rather than jumping between tabs. A short bar
		     centred over the tab, not a line across it (#77). -->
		<span
			aria-hidden="true"
			style:width="{100 / nav.length}%"
			style:translate="{Math.max(currentTab, 0) * 100}% 0"
			class={[
				'absolute top-0 left-0 flex justify-center transition duration-(--duration-motion) ease-(--ease-motion) motion-reduce:transition-none',
				currentTab < 0 && 'opacity-0'
			]}
		>
			<span class="h-0.5 w-8 rounded-full bg-accent"></span>
		</span>
		{#each nav as item (item.href)}
			<!-- eslint-disable svelte/no-navigation-without-resolve -- nav hrefs are plain strings from site.ts; resolve() needs route literals -->
			<a
				href={item.href}
				aria-current={current(item.href)}
				class="flex min-h-14 flex-col items-center justify-center gap-1 text-xs tracking-wide text-muted aria-[current=page]:font-semibold aria-[current=page]:text-accent"
			>
				<Icon name={item.icon} size={22} />
				<span>{item.label}</span>
			</a>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
		{/each}
	</nav>
{/if}

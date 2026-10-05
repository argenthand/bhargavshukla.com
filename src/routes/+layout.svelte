<script lang="ts">
	// Self-hosted fonts (#110, made by pnpm fonts). Not preloaded: on slow networks a preload took
	// bandwidth from the CSS and delayed the first paint (docs/performance.md).
	import '$lib/fonts/fonts.css';
	import './layout.css';
	import { onMount, tick, type Component } from 'svelte';
	import { onNavigate } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import ContactCard from '$lib/components/ContactCard.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import NavProgress from '$lib/components/NavProgress.svelte';
	import EightBitBanner from '$lib/components/EightBitBanner.svelte';
	import Shortcuts from '$lib/components/Shortcuts.svelte';
	import Toast from '$lib/components/Toast.svelte';
	import PalettePicker from '$lib/components/PalettePicker.svelte';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import { ABYSS_LINE, consoleNote } from '$lib/easter-eggs';
	import { konamiKeydown, taps } from '$lib/gestures';
	import { reducedMotion } from '$lib/motion';
	import { wake } from '$lib/eight-bit-sound';
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

	// Easter eggs (#111; gestures in src/lib/gestures.ts, #143). Three quick taps on the © line open
	// the controller; five on the current tab send its marker round the bar and back (not with
	// reduced motion). The controller loads on the first tap and opens on the third; the audio
	// starts inside that tap, as iOS requires.
	let Controller = $state<Component<Record<string, never>, { open: () => void }>>();
	let controller = $state<{ open: () => void }>();
	const loadController = () => import('$lib/components/Controller.svelte');

	function openController() {
		wake();
		void loadController().then(async (module) => {
			Controller = module.default;
			await tick();
			controller?.open();
		});
	}
	let marker = $state<HTMLElement>();

	function lap() {
		if (reducedMotion() || !marker) return;
		const at = (i: number, y = '0') => ({ translate: `${i * 100}% ${y}` });
		const last = nav.length - 1;
		// In 8-bit mode the marker is the red key; the current tab's label is black only on it.
		const tabs = marker.parentElement;
		tabs?.toggleAttribute('data-lapping', true);
		const lap = marker.animate(
			[
				{ ...at(currentTab), offset: 0 },
				{ ...at(last), offset: 0.35 },
				{ ...at(0), offset: 0.75 },
				{ ...at(currentTab), offset: 0.88 },
				{ ...at(currentTab, '-0.25rem'), offset: 0.94 },
				{ ...at(currentTab), offset: 1 }
			],
			{ duration: 1400, easing: 'ease-in-out' }
		);
		lap.finished.finally(() => tabs?.removeAttribute('data-lapping'));
	}
</script>

<svelte:head>
	<!-- Favicon (#89): the ICO for browsers and feed readers that skip SVG, then the SVG; iOS home screens. -->
	<link rel="icon" href="/favicon.ico" sizes="32x32" />
	<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
	<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
	<!-- Feed autodiscovery (#56): absolute, like canonical URLs. -->
	<link rel="alternate" type="application/rss+xml" title={site.name} href="{site.url}/rss.xml" />
</svelte:head>

<NavProgress />

<!-- Bottom padding keeps the footer clear of the fixed tab bar below md. -->
<div
	class={[
		'flex min-h-dvh flex-col bg-page print:block print:bg-transparent print:pb-0',
		nav.length > 0 && 'pb-[calc(var(--spacing-tab-bar)+env(safe-area-inset-bottom))] md:pb-0'
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
					<nav
						aria-label="Primary"
						data-sveltekit-preload-code="viewport"
						class="hidden items-center gap-2 md:flex"
					>
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

	<EightBitBanner />

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

	<!-- The contact card (#135): every page but the error page, which has no form action. -->
	{#if !page.error}
		<div class="mx-auto w-full max-w-3xl px-5 pb-8 md:px-8 print:hidden">
			<ContactCard />
		</div>
	{/if}

	<footer class="print:hidden">
		<div
			class="mx-auto flex min-h-19 max-w-5xl items-center justify-between px-5 py-4 meta md:px-8"
		>
			<!-- The NES controller's way in (#111): a plain line, so it adds no tab stop. -->
			<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
			<span
				class="select-none"
				onclick={() => void loadController()}
				{@attach taps(3, openController, { windowMs: 1000 })}>© {year} {site.name}</span
			>
			<!-- A server route, not a page: reload so the browser (or a feed reader) opens the XML. -->
			<a href={resolve('/rss.xml')} data-sveltekit-reload class="tap-target gap-1.5 link-quiet">
				<Icon name="rss" />RSS
			</a>
		</div>
	</footer>
</div>

<svelte:window onkeydown={konamiKeydown} />
<Shortcuts />
<Toast />
{#if Controller}<Controller bind:this={controller} />{/if}

<!-- Behind the page, so only a bounce past the end shows it (iOS and macOS Safari; #111). Above the
     tab bar on phones. -->
<p
	aria-hidden="true"
	class={[
		'fixed inset-x-0 -z-10 py-10 text-center meta print:hidden',
		nav.length > 0
			? 'bottom-[calc(var(--spacing-tab-bar)+env(safe-area-inset-bottom))] md:bottom-0'
			: 'bottom-0'
	]}
>
	{ABYSS_LINE}
</p>

<!-- The same Primary nav as a bottom tab bar below md; the header's copy is hidden there. -->
{#if nav.length > 0}
	<nav
		aria-label="Primary"
		data-sveltekit-preload-code="viewport"
		data-tabs
		style:view-transition-name="site-tabs"
		class="fixed inset-x-0 bottom-0 z-20 grid auto-cols-fr grid-flow-col bar-bottom pb-[env(safe-area-inset-bottom)] md:hidden print:hidden"
	>
		<!-- One marker for the current tab; it slides rather than jumping between tabs. A short bar
		     centred over the tab, not a line across it (#77). -->
		<span
			bind:this={marker}
			data-tab-marker
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
				{@attach current(item.href) && taps(5, lap)}
				class="relative flex min-h-tab-bar flex-col items-center justify-center gap-1 pt-1 text-xs tracking-wide text-muted aria-[current=page]:font-semibold aria-[current=page]:text-accent"
			>
				<Icon name={item.icon} size={22} />
				<span>{item.label}</span>
			</a>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
		{/each}
	</nav>
{/if}

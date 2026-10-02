<script lang="ts">
	// Back to top, with reading progress (#77, RA-post-*; replaces the #61 hairline): a round button
	// in the bottom-right corner, above the tab bar on phones. Its red ring fills as the article
	// scrolls past. It appears once the post title is out of view; pressing it goes back to the title
	// and moves focus there. Only with JavaScript, and never in print.
	import Icon from '$lib/components/Icon.svelte';
	import { reducedMotion } from '$lib/motion';

	let { article, title }: { article?: HTMLElement; title?: HTMLElement } = $props();

	let progress = $state(0);
	let shown = $state(false);

	$effect(() => {
		if (!article || !title) return;
		const body = article;
		const heading = title;
		let frame = 0;
		const measure = () => {
			frame = 0;
			const { top, height } = body.getBoundingClientRect();
			const scrollable = height - innerHeight;
			progress = scrollable > 0 ? Math.min(1, Math.max(0, -top / scrollable)) : 1;
			shown = heading.getBoundingClientRect().bottom < 0;
		};
		const schedule = () => (frame ||= requestAnimationFrame(measure));
		measure();
		addEventListener('scroll', schedule, { passive: true });
		addEventListener('resize', schedule, { passive: true });
		return () => {
			cancelAnimationFrame(frame);
			removeEventListener('scroll', schedule);
			removeEventListener('resize', schedule);
		};
	});

	function toTop() {
		title?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
		title?.focus({ preventScroll: true });
	}
</script>

<button
	type="button"
	aria-label="Back to top"
	onclick={toTop}
	tabindex={shown ? 0 : -1}
	class={[
		'fixed right-5 bottom-[calc(var(--spacing)*18+env(safe-area-inset-bottom))] z-20 hidden size-14 items-center justify-center rounded-full bg-raised text-ink shadow-lg transition-fade duration-(--duration-motion) ease-(--ease-motion) motion-reduce:transition-none md:right-8 md:bottom-8 js:not-print:flex',
		!shown && 'pointer-events-none invisible opacity-0'
	]}
>
	<!-- The ring: `pathLength` makes the dash a percentage of the circle. It starts at the top. -->
	<svg viewBox="0 0 56 56" aria-hidden="true" class="absolute inset-0 -rotate-90">
		<circle cx="28" cy="28" r="26.5" fill="none" stroke-width="3" class="stroke-line" />
		<circle
			cx="28"
			cy="28"
			r="26.5"
			fill="none"
			stroke-width="3"
			stroke-linecap="round"
			pathLength="100"
			stroke-dasharray="100"
			stroke-dashoffset={100 - progress * 100}
			class="stroke-accent"
		/>
	</svg>
	<Icon name="arrow-up" size={22} />
</button>

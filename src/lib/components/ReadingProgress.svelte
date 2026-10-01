<script lang="ts">
	// Reading progress (#61): a red hairline that fills as the article scrolls past. On phones it runs
	// along the sticky top bar's bottom border; from md, where the header scrolls away, at the top of
	// the window. It follows the scroll position, so there is no animation to turn off for reduced
	// motion. Only with JavaScript, and never in print.
	let { target }: { target?: HTMLElement } = $props();

	let progress = $state(0);

	$effect(() => {
		if (!target) return;
		const article = target;
		let frame = 0;
		const measure = () => {
			frame = 0;
			const { top, height } = article.getBoundingClientRect();
			const scrollable = height - innerHeight;
			progress = scrollable > 0 ? Math.min(1, Math.max(0, -top / scrollable)) : 1;
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
</script>

<div
	aria-hidden="true"
	style:scale="{progress} 1"
	class="fixed inset-x-0 top-14 z-20 hidden h-0.5 origin-left bg-red-700 md:top-0 dark:bg-red-400 js:not-print:block"
></div>

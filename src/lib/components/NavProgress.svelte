<script lang="ts">
	// The loading bar (#108): a thin accent line across the very top while a page loads, so a slow
	// network never looks like a frozen tab. CSS waits `--delay-progress` before showing it, so quick
	// navigations never flash it; when the page arrives it fills the width and fades out.
	import { navigating } from '$app/state';
	import { motionMs } from '$lib/motion';

	/** Fill from wherever the bar got to, then fade; nothing if it never showed. */
	function finish(node: HTMLElement) {
		const style = getComputedStyle(node);
		const from = parseFloat(style.scale) || 0;
		if (from === 0 || parseFloat(style.opacity) === 0) return { duration: 0 };
		return {
			duration: motionMs() * 2,
			// t runs from 1 to 0: fill during the first half, fade during the second.
			css: (t: number) =>
				`scale: ${from + (1 - from) * Math.min(1, 2 - 2 * t)} 1; opacity: ${Math.min(1, 2 * t)}`
		};
	}
</script>

{#if navigating.to}
	<div
		role="progressbar"
		aria-label="Loading page"
		out:finish
		class="fixed inset-x-0 top-0 z-30 h-0.5 origin-left animate-progress bg-accent motion-reduce:animate-progress-still print:hidden"
	></div>
{/if}

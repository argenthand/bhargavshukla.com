<script lang="ts">
	// "· 1.2K reads" at the end of a meta line (#87, RC-* on the canvas). With `track`, this page's
	// read is also counted after 10 seconds of reading, and its reading time sent to analytics (#154). JavaScript only. The space is held while the
	// count loads, and stays (empty) when there's none to show, so nothing on the page moves.
	import { trackReading } from '$lib/analytics';
	import { formatReads, readCount, trackRead } from '$lib/reads';

	let { path, track = false }: { path: string; track?: boolean } = $props();

	let count = $state<number>();

	$effect(() => {
		let current = true;
		count = undefined;
		readCount(path).then((n) => {
			if (current) count = n;
		});
		const stops = track ? [trackRead(path), trackReading()] : [];
		return () => {
			current = false;
			for (const stop of stops) stop();
		};
	});
</script>

<span class={['hidden items-center gap-2 meta js:inline-flex', count === undefined && 'invisible']}>
	<span aria-hidden="true">·</span>
	{#if count === undefined}
		<span aria-hidden="true">0 reads</span>
	{:else}
		<span class="motion-safe:animate-appear">{formatReads(count)}</span>
	{/if}
</span>

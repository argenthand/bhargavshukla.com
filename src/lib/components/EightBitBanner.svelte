<script lang="ts">
	// 8-bit mode's banner (#111, NES-A-* on the canvas): under the header while the mode is on, with
	// the sound switch and the way back to the palette underneath. It's on every page and shown by CSS
	// (`eight-bit:`, screen only), so a page that loads in 8-bit mode has it from the first paint,
	// without a shift, and paper never does (#147).
	// While the mode is on, buttons and links blip when pressed.
	import { Icon } from '$lib/site';
	import { blip, setSound, sound } from '$lib/eight-bit.svelte';
	import { look } from '$lib/look.svelte';

	// One listener for the whole page; the controller and this banner play their own sounds.
	$effect(() => {
		if (!look.eightBit) return;
		const onclick = (event: MouseEvent) => {
			const target = event.target instanceof Element ? event.target : null;
			if (!target?.closest('a[href], button, summary, label')) return;
			if (target.closest('[data-own-sound]')) return;
			blip('select');
		};
		document.addEventListener('click', onclick, true);
		return () => document.removeEventListener('click', onclick, true);
	});

	function back() {
		blip('back');
		look.setEightBit(false);
	}
</script>

<div
	role="region"
	aria-label="8-bit mode"
	data-own-sound
	class="hidden bg-accent text-page print:hidden eight-bit:block"
>
	<div class="mx-auto flex min-h-13 max-w-5xl items-center justify-between gap-3 px-5 md:px-8">
		<span class="inline-flex items-center gap-2.5 font-pixel text-xs">
			<!-- A pixel star, on a 7×7 grid so it stays crisp next to the pixel font. -->
			<svg
				width="14"
				height="14"
				viewBox="0 0 7 7"
				fill="currentColor"
				aria-hidden="true"
				shape-rendering="crispEdges"
				class="shrink-0"
			>
				<path d="M3 0h1v2H3zM0 2h7v1H0zM1 3h5v1H1zM1 4h2v1H1zM4 4h2v1H4zM0 5h2v2H0zM5 5h2v2H5z" />
			</svg>
			8-bit<span class="hidden sm:inline">&nbsp;mode</span>
		</span>
		<div class="flex items-center gap-2">
			<button
				type="button"
				aria-label="Sound"
				aria-pressed={sound.on}
				onclick={() => {
					setSound(!sound.on);
					blip('select');
				}}
				class="inline-flex size-11 items-center justify-center"
			>
				<Icon name={sound.on ? 'volume' : 'volume-off'} size={20} />
			</button>
			<button
				type="button"
				onclick={back}
				class="inline-flex min-h-10 items-center gap-2.5 bg-page px-3.5 text-sm text-accent"
			>
				<!-- A pixel arrow (left). -->
				<svg
					width="14"
					height="14"
					viewBox="0 0 7 7"
					fill="currentColor"
					aria-hidden="true"
					shape-rendering="crispEdges"
					class="shrink-0"
				>
					<path d="M3 0h1v1H3zM2 1h1v1H2zM1 2h1v1H1zM0 3h7v1H0zM1 4h1v1H1zM2 5h1v1H2zM3 6h1v1H3z" />
				</svg>
				Back to {look.paletteLabel}
			</button>
		</div>
	</div>
</div>

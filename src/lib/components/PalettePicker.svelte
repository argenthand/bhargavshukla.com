<script lang="ts">
	// The colour palette (#81, P-picker on the canvas): a dot in the current accent, next to the theme
	// toggle; it opens a small menu of palettes. The menu is a native popover (Esc and a click outside
	// close it) with radio buttons, so arrow keys move between palettes and each one applies at once.
	// JavaScript only; the inline script in app.html applies the saved palette before the first paint.
	//
	// In 8-bit mode (#111) the dot shows NES colours, and choosing a palette leaves the mode.
	// The palette disco (#111, src/lib/disco.ts): five quick taps on the dot and every palette plays
	// in turn, then it lands back where it was. Each tap before that opens or closes the menu as usual.
	import { tapCounter } from '$lib/easter-eggs';
	import { nes, setNes } from '$lib/nes.svelte';
	import { isPalette, PALETTES, setPalette, type PaletteId } from '$lib/theme';

	let current = $state<PaletteId>('newsprint');
	let button = $state<HTMLButtonElement>();
	let menu = $state<HTMLElement>();
	const taps = tapCounter(5, 2000);

	$effect(() => {
		const saved = document.documentElement.dataset.palette;
		if (isPalette(saved)) current = saved;
	});

	const label = $derived(nes.on ? '8-bit' : PALETTES.find((p) => p.id === current)?.label);

	/** Opens under the button, right edges aligned (the popover lives in the top layer). */
	function place(event: ToggleEvent) {
		if (event.newState !== 'open' || !button || !menu) return;
		const rect = button.getBoundingClientRect();
		menu.style.top = `${rect.bottom + 8}px`;
		menu.style.right = `${document.documentElement.clientWidth - rect.right}px`;
	}

	function choose(id: PaletteId) {
		current = id;
		setPalette(id);
		if (nes.on) setNes(false);
	}

	/** The fifth quick tap starts the disco instead of toggling the menu. Not in 8-bit mode. */
	function onclick(event: MouseEvent) {
		if (!taps() || nes.on) return;
		event.preventDefault();
		menu?.hidePopover();
		void import('$lib/disco').then(({ disco }) => disco(current));
	}
</script>

<button
	bind:this={button}
	type="button"
	popovertarget="palette-menu"
	aria-label="Colour: {label}"
	title="Colour: {label}"
	{onclick}
	class="hidden size-11 shrink-0 touch-manipulation items-center justify-center rounded-full bg-fill select-none js:flex"
>
	{#if nes.on}
		<span aria-hidden="true" class="grid size-4.5 grid-cols-2 overflow-hidden rounded-full">
			<span class="bg-(--nes-red)"></span><span class="bg-(--nes-sky)"></span>
			<span class="bg-(--nes-orange)"></span><span class="bg-(--nes-green)"></span>
		</span>
	{:else}
		<span aria-hidden="true" class="size-4.5 rounded-full bg-accent"></span>
	{/if}
</button>

<div
	bind:this={menu}
	id="palette-menu"
	popover
	ontoggle={place}
	class="fixed inset-auto m-0 w-48 rounded-xl bg-raised p-1.5 text-ink shadow-xl"
>
	<fieldset class="flex flex-col gap-0.5">
		<legend class="sr-only">Colour</legend>
		{#each PALETTES as palette (palette.id)}
			<label
				class="flex min-h-10 items-center gap-2.5 rounded-lg px-3 text-base has-checked:bg-fill has-focus-visible:outline-2 has-focus-visible:outline-accent"
			>
				<input
					type="radio"
					name="palette"
					value={palette.id}
					checked={current === palette.id && !nes.on}
					onchange={() => choose(palette.id)}
					class="sr-only"
				/>
				<span aria-hidden="true" class="size-4.5 shrink-0 rounded-full {palette.swatch}"></span>
				{palette.label}<span class="sr-only">, {palette.hue}</span>
			</label>
		{/each}
	</fieldset>
</div>

<script lang="ts">
	// The colour palette (#81, P-picker on the canvas): a dot in the current accent, next to the theme
	// toggle; it opens a small menu of palettes. The menu is a native popover (Esc and a click outside
	// close it) with radio buttons, so arrow keys move between palettes and each one applies at once;
	// a tap, click or Enter on one closes the menu.
	// JavaScript only; the inline script in app.html applies the saved palette before the first paint.
	//
	// In 8-bit mode (#111) the dot shows NES colours, and choosing a palette leaves the mode.
	// The palette disco (#111, src/lib/disco.ts): five quick taps on the dot and every palette plays
	// in turn, then it lands back where it was. Each tap before that opens or closes the menu as usual.
	import { tapCounter } from '$lib/easter-eggs';
	import { look, PALETTES } from '$lib/look.svelte';

	let button = $state<HTMLButtonElement>();
	let menu = $state<HTMLElement>();
	const taps = tapCounter(5, 2000);

	const label = $derived(look.eightBit ? '8-bit' : look.paletteLabel);

	/** Opens under the button, right edges aligned (the popover lives in the top layer). */
	function place(event: ToggleEvent) {
		if (event.newState !== 'open' || !button || !menu) return;
		const rect = button.getBoundingClientRect();
		menu.style.top = `${rect.bottom + 8}px`;
		menu.style.right = `${document.documentElement.clientWidth - rect.right}px`;
	}

	/**
	 * A tap or click on a palette closes the menu. Keyboard clicks (detail 0) come from the arrow
	 * keys moving between palettes, so the menu stays open for those; Enter closes it.
	 */
	function closeAfterPick(event: MouseEvent) {
		const onPalette = event.target instanceof Element && event.target.closest('label');
		if (event.detail > 0 && onPalette) menu?.hidePopover();
	}
	function closeOnEnter(event: KeyboardEvent) {
		if (event.key !== 'Enter') return;
		// Focus goes back to the dot; without this, the same Enter would reopen the menu there.
		event.preventDefault();
		menu?.hidePopover();
	}
	$effect(() => {
		menu?.addEventListener('click', closeAfterPick);
		menu?.addEventListener('keydown', closeOnEnter);
		return () => {
			menu?.removeEventListener('click', closeAfterPick);
			menu?.removeEventListener('keydown', closeOnEnter);
		};
	});

	/** The fifth quick tap starts the disco instead of toggling the menu. Not in 8-bit mode. */
	function onclick(event: MouseEvent) {
		if (!taps() || look.eightBit) return;
		event.preventDefault();
		menu?.hidePopover();
		void import('$lib/disco').then(({ disco }) => disco());
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
	{#if look.eightBit}
		<span aria-hidden="true" class="grid size-4.5 grid-cols-2 overflow-hidden rounded-full">
			<span class="bg-(--night-red)"></span><span class="bg-(--night-sky)"></span>
			<span class="bg-(--night-orange)"></span><span class="bg-(--night-green)"></span>
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
					checked={look.palette === palette.id && !look.eightBit}
					onchange={() => look.choosePalette(palette.id)}
					class="sr-only"
				/>
				<span aria-hidden="true" class="size-4.5 shrink-0 rounded-full {palette.swatch}"></span>
				{palette.label}<span class="sr-only">, {palette.hue}</span>
			</label>
		{/each}
	</fieldset>
</div>

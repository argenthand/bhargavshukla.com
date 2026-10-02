<script lang="ts">
	// The colour palette (#81, P-picker on the canvas): a dot in the current accent, next to the theme
	// toggle; it opens a small menu of palettes. The menu is a native popover (Esc and a click outside
	// close it) with radio buttons, so arrow keys move between palettes and each one applies at once.
	// JavaScript only; the inline script in app.html applies the saved palette before the first paint.
	import { isPalette, PALETTES, setPalette, type PaletteId } from '$lib/theme';

	let current = $state<PaletteId>('newsprint');
	let button = $state<HTMLButtonElement>();
	let menu = $state<HTMLElement>();

	$effect(() => {
		const saved = document.documentElement.dataset.palette;
		if (isPalette(saved)) current = saved;
	});

	const label = $derived(PALETTES.find((p) => p.id === current)?.label);

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
	}
</script>

<button
	bind:this={button}
	type="button"
	popovertarget="palette-menu"
	aria-label="Colour: {label}"
	title="Colour: {label}"
	class="hidden size-11 shrink-0 items-center justify-center rounded-full bg-fill js:flex"
>
	<span aria-hidden="true" class="size-4.5 rounded-full bg-accent"></span>
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
					checked={current === palette.id}
					onchange={() => choose(palette.id)}
					class="sr-only"
				/>
				<span aria-hidden="true" class="size-4.5 shrink-0 rounded-full {palette.swatch}"></span>
				{palette.label}<span class="sr-only">, {palette.hue}</span>
			</label>
		{/each}
	</fieldset>
</div>

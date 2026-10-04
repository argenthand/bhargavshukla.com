<script lang="ts">
	// The colour palette (#81, P-picker on the canvas): a dot in the current accent, next to the theme
	// toggle; it opens a small menu of palettes. The menu is a native popover (Esc and a click outside
	// close it) with radio buttons, so arrow keys move between palettes and each one applies at once.
	// JavaScript only; the inline script in app.html applies the saved palette before the first paint.
	//
	// In 8-bit mode (#111) the dot shows NES colours, and choosing a palette leaves the mode.
	// The palette disco (#111, src/lib/disco.ts): press and hold the dot (a ring fills) and every
	// palette plays in turn, then it lands back where it was.
	import { nes, setNes } from '$lib/nes.svelte';
	import { isPalette, PALETTES, setPalette, type PaletteId } from '$lib/theme';

	let current = $state<PaletteId>('newsprint');
	let button = $state<HTMLButtonElement>();
	let menu = $state<HTMLElement>();
	let holding = $state(false);
	let holdTimer: ReturnType<typeof setTimeout>;
	let held = false;

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

	function startHold(event: PointerEvent) {
		if (nes.on || event.button !== 0) return;
		held = false;
		holding = true;
		holdTimer = setTimeout(() => {
			holding = false;
			held = true;
			void import('$lib/disco').then(({ disco }) => disco(current));
		}, holdMs());
	}

	function endHold() {
		clearTimeout(holdTimer);
		holding = false;
	}

	/** `--duration-hold` in ms: the ring and the timer share it. */
	function holdMs() {
		return parseFloat(
			getComputedStyle(document.documentElement).getPropertyValue('--duration-hold')
		);
	}

	/** After a long press, the click that follows mustn't open the menu. */
	function onclick(event: MouseEvent) {
		if (!held) return;
		held = false;
		event.preventDefault();
	}
</script>

<button
	bind:this={button}
	type="button"
	popovertarget="palette-menu"
	aria-label="Colour: {label}"
	title="Colour: {label}"
	onpointerdown={startHold}
	onpointerup={endHold}
	onpointerleave={endHold}
	onpointercancel={endHold}
	{onclick}
	oncontextmenu={(event) => event.preventDefault()}
	class="relative hidden size-11 shrink-0 touch-manipulation items-center justify-center rounded-full bg-fill select-none js:flex"
>
	{#if nes.on}
		<span aria-hidden="true" class="grid size-4.5 grid-cols-2 overflow-hidden rounded-full">
			<span class="bg-(--nes-red)"></span><span class="bg-(--nes-sky)"></span>
			<span class="bg-(--nes-orange)"></span><span class="bg-(--nes-green)"></span>
		</span>
	{:else}
		<span aria-hidden="true" class="size-4.5 rounded-full bg-accent"></span>
	{/if}
	{#if holding}
		<svg viewBox="0 0 48 48" aria-hidden="true" class="absolute inset-0 -rotate-90">
			<circle
				cx="24"
				cy="24"
				r="22.5"
				fill="none"
				pathLength="100"
				stroke-dasharray="100"
				class="animate-hold stroke-accent stroke-3 motion-reduce:animate-none"
			/>
		</svg>
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

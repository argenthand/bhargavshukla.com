<script lang="ts">
	// The NES controller (#111, EGG-controller on the canvas): three quick taps on the footer's ©
	// line open it, so phones can enter the Konami code too. The layout loads it on the first tap. No instructions: anyone who grew up with
	// one knows what to press. A popover, so a tap outside, Esc or × closes it. Presses blip; the
	// strip echoes the last few. ↑↑↓↓←→←→ B A starts 8-bit mode.
	import { Icon } from '$lib/site';
	import { blip } from '$lib/eight-bit.svelte';
	import { konamiKey } from '$lib/gestures';
	import { keepAwake } from '$lib/eight-bit-sound';

	/** How each key shows on the strip. */
	const KEY_SYMBOLS: Record<string, string> = {
		arrowup: '↑',
		arrowdown: '↓',
		arrowleft: '←',
		arrowright: '→',
		b: 'B',
		a: 'A'
	};

	let pad = $state<HTMLElement>();
	let pressed = $state<string[]>([]);

	/** Called once loaded, after the © line's third tap (which started the audio). */
	export function open() {
		pad?.showPopover();
	}

	function press(key: string) {
		blip(key in KEY_SYMBOLS ? 'press' : 'select');
		if (key in KEY_SYMBOLS) pressed = [...pressed, KEY_SYMBOLS[key]].slice(-10);
		// The code is one sequence with the keyboard's (#143); completing it starts 8-bit mode.
		if (konamiKey(key)) pad?.hidePopover();
	}

	function ontoggle(event: ToggleEvent) {
		const isOpen = event.newState === 'open';
		keepAwake(isOpen);
		if (!isOpen) pressed = [];
	}

	// Presses land on pointerdown, so quick taps feel like a pad; keyboard presses arrive as clicks
	// with no pointer (detail 0).
	function onpointerdown(event: PointerEvent, key: string) {
		event.preventDefault();
		press(key);
	}
	function onclick(event: MouseEvent, key: string) {
		if (event.detail === 0) press(key);
	}

	const dpad = [
		{ key: 'arrowup', label: 'Up', cell: 'col-start-2 row-start-1', rotate: 'rotate-0' },
		{ key: 'arrowleft', label: 'Left', cell: 'col-start-1 row-start-2', rotate: '-rotate-90' },
		{ key: 'arrowright', label: 'Right', cell: 'col-start-3 row-start-2', rotate: 'rotate-90' },
		{ key: 'arrowdown', label: 'Down', cell: 'col-start-2 row-start-3', rotate: 'rotate-180' }
	];
</script>

<div
	bind:this={pad}
	id="controller"
	data-konami-pad
	popover
	{ontoggle}
	aria-label="NES controller"
	data-own-sound
	class="fixed inset-x-1 top-auto bottom-4 m-0 mx-auto max-w-md animate-slide-up touch-manipulation rounded-xl bg-pad-body p-1.5 shadow-2xl select-none backdrop:bg-black/55 motion-reduce:animate-none md:bottom-8 print:hidden"
>
	<div class="flex min-h-11 items-center justify-between pl-2">
		<span aria-hidden="true" class="font-pixel text-xs text-pad-face">{pressed.join('')}</span>
		<button
			type="button"
			aria-label="Close controller"
			popovertarget="controller"
			popovertargetaction="hide"
			class="inline-flex size-11 items-center justify-center text-pad-face"
		>
			<Icon name="close" size={20} />
		</button>
	</div>
	<div class="flex items-center justify-between gap-1 rounded-md bg-pad-face px-1.5 py-3.5">
		<div class="grid shrink-0 grid-cols-3 grid-rows-3">
			{#each dpad as arrow (arrow.key)}
				<button
					type="button"
					aria-label={arrow.label}
					onpointerdown={(event) => onpointerdown(event, arrow.key)}
					onclick={(event) => onclick(event, arrow.key)}
					class="{arrow.cell} inline-flex size-11 items-center justify-center bg-pad-key text-pad-body active:bg-pad-body active:text-pad-face"
				>
					<svg width="14" height="14" viewBox="0 0 10 10" aria-hidden="true" class={arrow.rotate}>
						<path d="M5 1 9 8H1z" fill="currentColor" />
					</svg>
				</button>
			{/each}
			<span aria-hidden="true" class="col-start-2 row-start-2 bg-pad-key"></span>
		</div>
		<div class="flex">
			{#each ['Select', 'Start'] as label (label)}
				<div class="flex flex-col items-center gap-1">
					<span aria-hidden="true" class="font-pixel text-pixel-xs text-pad-label">{label}</span>
					<button
						type="button"
						aria-label={label}
						onpointerdown={(event) => onpointerdown(event, label.toLowerCase())}
						onclick={(event) => onclick(event, label.toLowerCase())}
						class="group inline-flex size-11 items-center justify-center"
					>
						<span class="h-3 w-8 rounded-full bg-pad-key group-active:bg-pad-body"></span>
					</button>
				</div>
			{/each}
		</div>
		<div class="flex items-end gap-2 pr-1">
			{#each ['B', 'A'] as label (label)}
				<div class="flex flex-col items-center gap-1.5">
					<button
						type="button"
						aria-label={label}
						onpointerdown={(event) => onpointerdown(event, label.toLowerCase())}
						onclick={(event) => onclick(event, label.toLowerCase())}
						class="size-11 rounded-full bg-pad-button ring-3 ring-pad-body active:scale-95"
					></button>
					<span aria-hidden="true" class="font-pixel text-pixel-sm text-pad-label">{label}</span>
				</div>
			{/each}
		</div>
	</div>
</div>

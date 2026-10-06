<script lang="ts">
	// Keyboard shortcuts (#63, F-shortcuts-*): `?` opens this panel, `g` then a letter goes to a live
	// section, and `/` searches on Writing. Nothing fires while typing in a field or with Ctrl/⌘/Alt
	// held, so browser and screen reader shortcuts keep working. The Konami code is a gesture, not a
	// shortcut: src/lib/gestures.ts, listened for by the layout (#143).
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { Icon, nav } from '$lib/site';
	import { leaveKeyAlone } from '$lib/gestures';

	/** How long `g` waits for its second key. */
	const SEQUENCE_MS = 1500;

	const destinations = [
		{ key: 'h', href: resolve('/'), label: 'Home' },
		...nav.map((section) => ({ key: section.shortcut, href: section.href, label: section.label }))
	];
	const onWriting = $derived(page.route.id === '/blog');

	let dialog = $state<HTMLDialogElement>();
	let waitingForG = false;
	let gTimer: ReturnType<typeof setTimeout>;

	function onkeydown(event: KeyboardEvent) {
		if (leaveKeyAlone(event)) return;

		if (waitingForG) {
			waitingForG = false;
			clearTimeout(gTimer);
			const destination = destinations.find((d) => d.key === event.key.toLowerCase());
			if (!destination) return;
			event.preventDefault();
			dialog?.close();
			goto(destination.href);
		} else if (event.key === 'g') {
			waitingForG = true;
			gTimer = setTimeout(() => (waitingForG = false), SEQUENCE_MS);
		} else if (event.key === '?') {
			event.preventDefault();
			if (dialog?.open) dialog.close();
			else dialog?.showModal();
		} else if (event.key === '/' && onWriting) {
			const search = document.getElementById('q');
			if (!search) return;
			event.preventDefault();
			dialog?.close();
			search.focus();
		}
	}

	/** A click on the backdrop lands on the <dialog> itself. */
	function closeOnBackdrop(event: MouseEvent) {
		if (event.target === dialog) dialog?.close();
	}
</script>

<svelte:window {onkeydown} />

{#snippet keys(sequence: string[])}
	<span class="inline-flex shrink-0 items-center gap-1.5">
		{#each sequence as key, i (i)}
			{#if i > 0}<span class="meta">then</span>{/if}
			<kbd class="key-cap">{key}</kbd>
		{/each}
	</span>
{/snippet}

{#snippet group(title: string, rows: { label: string; sequence: string[] }[])}
	<section class="flex flex-col gap-1">
		<h3 class="label-muted">{title}</h3>
		<dl>
			{#each rows as row (row.label)}
				<div class="flex min-h-11 items-center justify-between gap-4">
					<dt class="text-lg">{row.label}</dt>
					<dd>{@render keys(row.sequence)}</dd>
				</div>
			{/each}
		</dl>
	</section>
{/snippet}

<dialog
	bind:this={dialog}
	onclick={closeOnBackdrop}
	aria-labelledby="shortcuts-title"
	class="m-auto w-md rounded-xl bg-page px-6 pt-2 pb-6 text-ink shadow-2xl backdrop:bg-black/45 dark:backdrop:bg-black/60"
>
	<div class="flex flex-col gap-5">
		<div class="flex min-h-11 items-center justify-between">
			<h2 id="shortcuts-title" class="label">Keyboard shortcuts</h2>
			<button
				type="button"
				aria-label="Close"
				onclick={() => dialog?.close()}
				class="-mr-3 inline-flex min-h-11 min-w-11 items-center justify-center text-muted"
			>
				<Icon name="close" size={20} />
			</button>
		</div>
		{@render group(
			'Go to',
			destinations.map((d) => ({ label: d.label, sequence: ['g', d.key] }))
		)}
		{#if onWriting}
			{@render group('On this page', [{ label: 'Search titles', sequence: ['/'] }])}
		{/if}
		{@render group('Anywhere', [
			{ label: 'Show these shortcuts', sequence: ['?'] },
			{ label: 'Close this panel', sequence: ['Esc'] }
		])}
		<p class="meta">Shortcuts are off while you type in a field.</p>
	</div>
</dialog>

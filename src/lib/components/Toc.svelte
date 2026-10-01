<script lang="ts">
	// Table of contents (docs/design.md → Table of contents: behaviour).
	// `pill`: below lg, a sticky "On this page" pill that opens a bottom sheet; without JS, a
	// collapsed <details> instead. `sidebar`: lg+, a sticky list beside the article.
	// Both highlight the section being read (aria-current="location"); that is the only progress cue.
	import Icon from '$lib/components/Icon.svelte';
	import type { Heading } from '$lib/types/content';

	let { headings, variant }: { headings: Heading[]; variant: 'pill' | 'sidebar' } = $props();

	/** Where the sticky bars end: a heading above this line has been "reached". */
	const LINE = 72;

	let reached = $state<string>();
	// Before the first heading is reached, the first item is active.
	const active = $derived(reached ?? headings[0]?.id);
	let dialog = $state<HTMLDialogElement>();

	const activeText = $derived(headings.find((h) => h.id === active)?.text);

	$effect(() => {
		const elements = headings
			.map((h) => document.getElementById(h.id))
			.filter((el): el is HTMLElement => el !== null);

		const update = () => {
			let current = headings[0]?.id;
			for (const el of elements) {
				if (el.getBoundingClientRect().top > LINE + 1) break;
				current = el.id;
			}
			reached = current;
		};

		const observer = new IntersectionObserver(update, { rootMargin: `-${LINE}px 0px -65% 0px` });
		for (const el of elements) observer.observe(el);
		update();
		return () => observer.disconnect();
	});

	/** From the sheet: close first, then scroll to the heading and move focus to it. */
	function choose(event: MouseEvent, id: string) {
		event.preventDefault();
		dialog?.close();
		const target = document.getElementById(id);
		if (!target) return;
		const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
		target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
		target.focus({ preventScroll: true });
	}

	/** A click on the backdrop lands on the <dialog> itself. */
	function closeOnBackdrop(event: MouseEvent) {
		if (event.target === dialog) dialog?.close();
	}
</script>

{#snippet list(onchoose?: (event: MouseEvent, id: string) => void)}
	<ol>
		{#each headings as heading (heading.id)}
			<li>
				<a
					href="#{heading.id}"
					data-level={heading.level}
					aria-current={active === heading.id ? 'location' : undefined}
					onclick={onchoose && ((event) => onchoose(event, heading.id))}
					class="flex min-h-10 items-center border-l-2 border-neutral-200 py-1.5 pl-3 text-base/snug text-neutral-900 aria-[current=location]:border-red-700 aria-[current=location]:font-semibold aria-[current=location]:text-red-700 data-[level=3]:pl-7 data-[level=3]:text-sm data-[level=3]:text-neutral-600 dark:border-neutral-800 dark:text-neutral-100 dark:aria-[current=location]:border-red-400 dark:aria-[current=location]:text-red-400 dark:data-[level=3]:text-neutral-400"
				>
					{heading.text}
				</a>
			</li>
		{/each}
	</ol>
{/snippet}

{#if variant === 'pill'}
	<!-- Without JavaScript: the same list, collapsed. -->
	<details class="mb-7 border border-neutral-200 px-4 lg:hidden dark:border-neutral-800 js:hidden">
		<summary class="flex min-h-11 cursor-pointer items-center meta"> On this page </summary>
		<div class="pb-3">{@render list()}</div>
	</details>

	<div class="sticky top-16 z-10 mb-7 hidden js:max-lg:block">
		<button
			type="button"
			aria-haspopup="dialog"
			onclick={() => dialog?.showModal()}
			class="flex min-h-11 w-full items-center gap-2.5 border border-neutral-200 bg-white px-4 text-left text-sm shadow-sm dark:border-neutral-800 dark:bg-neutral-950"
		>
			<Icon name="list" class="text-neutral-600 dark:text-neutral-400" />
			<span class="text-neutral-600 dark:text-neutral-400">On this page</span>
			<span class="flex-1 truncate font-semibold">{activeText}</span>
			<Icon name="chevron-down" class="text-neutral-600 dark:text-neutral-400" />
		</button>
	</div>

	<dialog
		bind:this={dialog}
		onclick={closeOnBackdrop}
		aria-labelledby="toc-sheet-title"
		class="fixed inset-x-0 top-auto bottom-0 m-0 max-h-sheet w-full max-w-none border-t border-neutral-200 bg-white px-5 pt-2 pb-[calc(1.5rem+env(safe-area-inset-bottom))] text-neutral-900 shadow-2xl backdrop:bg-black/45 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100"
	>
		<div
			aria-hidden="true"
			class="mx-auto h-1 w-9 rounded-full bg-neutral-900/30 dark:bg-neutral-100/30"
		></div>
		<div class="flex items-center justify-between py-2">
			<h2 id="toc-sheet-title" class="label">On this page</h2>
			<button
				type="button"
				aria-label="Close"
				onclick={() => dialog?.close()}
				class="-mr-3 inline-flex min-h-11 min-w-11 items-center justify-center"
			>
				<Icon name="close" size={20} />
			</button>
		</div>
		{@render list(choose)}
	</dialog>
{:else}
	<nav aria-label="Table of contents">
		<h2 class="mb-3 label">Contents</h2>
		{@render list()}
	</nav>
{/if}

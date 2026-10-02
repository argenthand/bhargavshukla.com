<script lang="ts">
	// Table of contents (docs/design.md → Table of contents: behaviour).
	// `pill`: below lg, a sticky "On this page" pill that opens a bottom sheet; without JS, a
	// collapsed <details> instead. `sidebar`: lg+, a sticky list beside the article.
	// Both highlight the section being read (aria-current="location"); with JS one red marker slides
	// between entries (#61), without it the current entry's own border is red.
	import type { Attachment } from 'svelte/attachments';
	import Icon from '$lib/components/Icon.svelte';
	import { reducedMotion } from '$lib/motion';
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

		let frame = 0;
		const update = () => {
			frame = 0;
			let current = headings[0]?.id;
			for (const el of elements) {
				if (el.getBoundingClientRect().top > LINE + 1) break;
				current = el.id;
			}
			reached = current;
		};

		// Checked on every scroll (once per frame), not only when a heading crosses a band: a jump or
		// a fast fling can land with no heading near the line and would leave the old entry current.
		const schedule = () => (frame ||= requestAnimationFrame(update));
		update();
		addEventListener('scroll', schedule, { passive: true });
		addEventListener('resize', schedule, { passive: true });
		return () => {
			cancelAnimationFrame(frame);
			removeEventListener('scroll', schedule);
			removeEventListener('resize', schedule);
		};
	});

	/** From the sheet: close first, then scroll to the heading and move focus to it. */
	function choose(event: MouseEvent, id: string) {
		event.preventDefault();
		dialog?.close();
		const target = document.getElementById(id);
		if (!target) return;
		target.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
		target.focus({ preventScroll: true });
	}

	/**
	 * Moves the list's marker over the current entry, with transform only: `translate` to its top and
	 * `scale` to its height (the marker is 1px tall), so entries that wrap work too. Re-measured when
	 * the list resizes: the sheet and the <details> have no layout until they open. The first
	 * placement doesn't slide; `data-placed` turns the transition on a frame later.
	 */
	const marker: Attachment<HTMLElement> = (list) => {
		const id = active;
		const place = () => {
			const bar = list.querySelector<HTMLElement>('[data-toc-marker]');
			const link = id && list.querySelector<HTMLElement>(`a[href="#${CSS.escape(id)}"]`);
			if (!bar || !link || !link.offsetHeight) return;
			bar.style.translate = `0 ${link.offsetTop}px`;
			bar.style.scale = `1 ${link.offsetHeight}`;
			if (!bar.hasAttribute('data-placed'))
				requestAnimationFrame(() => bar.toggleAttribute('data-placed', true));
		};
		place();
		const observer = new ResizeObserver(place);
		observer.observe(list);
		return () => observer.disconnect();
	};

	/** A click on the backdrop lands on the <dialog> itself. */
	function closeOnBackdrop(event: MouseEvent) {
		if (event.target === dialog) dialog?.close();
	}
</script>

{#snippet list(onchoose?: (event: MouseEvent, id: string) => void)}
	<div class="relative" {@attach marker}>
		<span
			aria-hidden="true"
			data-toc-marker
			class="pointer-events-none absolute top-0 left-0 hidden h-px w-0.5 origin-top bg-accent opacity-0 data-placed:opacity-100 motion-safe:data-placed:transition-[translate,scale] motion-safe:data-placed:duration-(--duration-motion) motion-safe:data-placed:ease-(--ease-motion) js:block"
		></span>
		<ol>
			{#each headings as heading (heading.id)}
				<li>
					<a
						href="#{heading.id}"
						data-level={heading.level}
						aria-current={active === heading.id ? 'location' : undefined}
						onclick={onchoose && ((event) => onchoose(event, heading.id))}
						class="flex min-h-10 items-center border-l-2 border-line py-1.5 pl-3 text-base/snug text-ink aria-[current=location]:border-accent aria-[current=location]:font-semibold aria-[current=location]:text-accent data-[level=3]:pl-7 data-[level=3]:text-sm data-[level=3]:text-muted js:aria-[current=location]:border-line"
					>
						{heading.text}
					</a>
				</li>
			{/each}
		</ol>
	</div>
{/snippet}

{#if variant === 'pill'}
	<!-- Without JavaScript: the same list, collapsed. -->
	<details class="mb-7 surface px-4 lg:hidden js:hidden">
		<summary class="flex min-h-11 items-center meta"> On this page </summary>
		<div class="pb-3">{@render list()}</div>
	</details>

	<div class="sticky top-16 z-10 mb-7 hidden js:max-lg:block">
		<button
			type="button"
			aria-haspopup="dialog"
			onclick={() => dialog?.showModal()}
			class="flex pill w-full text-left text-sm"
		>
			<Icon name="list" class="text-muted" />
			<span class="text-muted">On this page</span>
			<span class="flex-1 truncate font-semibold">{activeText}</span>
			<Icon name="chevron-down" class="text-muted" />
		</button>
	</div>

	<dialog
		bind:this={dialog}
		onclick={closeOnBackdrop}
		aria-labelledby="toc-sheet-title"
		class="fixed inset-x-0 top-auto bottom-0 m-0 max-h-sheet w-full max-w-none rounded-t-xl bg-page px-5 pt-2 pb-[calc(1.5rem+env(safe-area-inset-bottom))] text-ink shadow-2xl backdrop:bg-black/45"
	>
		<div aria-hidden="true" class="mx-auto h-1 w-9 rounded-full bg-ink/30"></div>
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

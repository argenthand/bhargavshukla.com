<script lang="ts">
	// Rendered Markdown (src/lib/content/server/markdown.ts) in the article styles from docs/design.md,
	// plus its two tools (#61): the code blocks' Copy button and, in posts, the headings' "#" links,
	// which copy the section URL. Both confirm on screen for a moment and through the status region.
	import { replaceState } from '$app/navigation';
	import { page } from '$app/state';

	let { html }: { html: string } = $props();

	/** How long a confirmation stays up. */
	const CONFIRM_MS = 1500;

	let status = $state('');
	const timers = new WeakMap<Element, ReturnType<typeof setTimeout>>();

	/** Run `undo` after CONFIRM_MS; another click on the same element starts the wait again. */
	function later(element: Element, undo: () => void) {
		clearTimeout(timers.get(element));
		timers.set(element, setTimeout(undo, CONFIRM_MS));
	}

	async function copyCode(button: HTMLButtonElement) {
		const code = button.closest('.code-block')?.querySelector('pre')?.textContent;
		const label = button.querySelector('[data-copy-label]');
		if (code == null || !label) return;
		try {
			await navigator.clipboard.writeText(code);
			label.textContent = 'Copied';
			button.toggleAttribute('data-copied', true);
			status = 'Code copied to clipboard';
		} catch {
			label.textContent = 'Copy failed';
			status = 'Copy failed';
		}
		later(button, () => {
			label.textContent = 'Copy';
			button.removeAttribute('data-copied');
			status = ''; // So the next copy is announced again.
		});
	}

	async function copyLink(link: HTMLAnchorElement, event: MouseEvent) {
		event.preventDefault();
		const url = new URL(link.href);
		try {
			await navigator.clipboard.writeText(url.href);
		} catch {
			location.hash = url.hash; // Can't copy: at least go to the section, as without JavaScript.
			return;
		}
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- same page, only the hash changes
		replaceState(url.hash, page.state);
		const toast = link.querySelector('[data-heading-toast]') ?? link.appendChild(linkToast());
		status = 'Link to this section copied';
		later(link, () => {
			toast.remove();
			status = '';
		});
	}

	/** "Link copied", shown above the "#" (the status region tells screen readers). */
	function linkToast() {
		const toast = document.createElement('span');
		toast.setAttribute('data-heading-toast', '');
		toast.setAttribute('aria-hidden', 'true');
		toast.className = 'heading-toast';
		toast.textContent = 'Link copied';
		return toast;
	}

	function onclick(event: MouseEvent) {
		const target = event.target as Element;
		const button = target.closest<HTMLButtonElement>('button[data-copy]');
		if (button) return copyCode(button);
		const link = target.closest<HTMLAnchorElement>('a[data-heading-link]');
		if (link) return copyLink(link, event);
	}
</script>

<!-- The only interactive elements inside are the Copy buttons and heading links; the click is
     delegated to them. -->
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div
	{onclick}
	class="prose prose-lg max-w-none prose-roles prose-headings:font-semibold prose-headings:tracking-tight prose-headings:text-balance prose-h2:text-2xl md:prose-h2:text-3xl prose-h3:text-xl prose-a:text-accent prose-a:decoration-1 prose-a:underline-offset-4 prose-a:hover:text-accent-hover prose-a:hover:decoration-2 prose-blockquote:border-0 prose-blockquote:pl-0 prose-blockquote:text-2xl prose-blockquote:font-normal prose-blockquote:quote-marks prose-blockquote:text-ink prose-figcaption:text-sm prose-code:font-normal prose-code:before:content-none prose-code:after:content-none [&_:not(pre)>code]:bg-chip [&_:not(pre)>code]:px-1.5 [&_:not(pre)>code]:py-0.5"
>
	<!-- eslint-disable-next-line svelte/no-at-html-tags -- the author's own Markdown from Strapi, rendered on the server -->
	{@html html}
</div>
<!-- What screen readers hear after a copy. -->
<p role="status" class="sr-only">{status}</p>

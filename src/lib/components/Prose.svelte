<script lang="ts">
	// Rendered Markdown (src/lib/server/markdown.ts) in the article styles from docs/design.md,
	// plus the code blocks' Copy button.
	let { html }: { html: string } = $props();

	async function copy(event: MouseEvent) {
		const button = (event.target as Element).closest<HTMLButtonElement>('button[data-copy]');
		const code = button?.closest('.code-block')?.querySelector('pre')?.textContent;
		const label = button?.querySelector('[data-copy-label]');
		if (!button || code == null || !label) return;
		try {
			await navigator.clipboard.writeText(code);
			label.textContent = 'Copied';
		} catch {
			label.textContent = 'Copy failed';
		}
		setTimeout(() => (label.textContent = 'Copy'), 2000);
	}
</script>

<!-- The only interactive elements inside are the Copy buttons; the click is delegated to them. -->
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div
	onclick={copy}
	class="prose prose-lg max-w-none prose-neutral dark:prose-invert prose-headings:font-semibold prose-headings:tracking-tight prose-headings:text-balance prose-h2:text-2xl md:prose-h2:text-3xl prose-h3:text-xl prose-a:text-red-700 prose-a:underline-offset-4 hover:prose-a:text-red-800 dark:prose-a:text-red-400 dark:hover:prose-a:text-red-300 prose-blockquote:border-y prose-blockquote:border-l-0 prose-blockquote:border-neutral-200 prose-blockquote:py-6 prose-blockquote:pl-0 prose-blockquote:text-2xl prose-blockquote:font-normal prose-blockquote:text-neutral-900 dark:prose-blockquote:border-neutral-800 dark:prose-blockquote:text-neutral-100 prose-figcaption:text-sm prose-code:font-normal prose-code:before:content-none prose-code:after:content-none [&_:not(pre)>code]:bg-neutral-100 [&_:not(pre)>code]:px-1.5 [&_:not(pre)>code]:py-0.5 dark:[&_:not(pre)>code]:bg-neutral-800"
>
	<!-- eslint-disable-next-line svelte/no-at-html-tags -- the author's own Markdown from Strapi, rendered on the server -->
	{@html html}
</div>

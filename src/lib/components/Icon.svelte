<script lang="ts" module>
	export type IconName = 'arrow-right' | 'mail' | 'external' | 'rss' | 'pen' | 'code' | 'file';
</script>

<script lang="ts">
	// Stroke icons from the mockups. Decorative only: the text next to them is the label.
	let {
		name,
		size = 16,
		class: className = ''
	}: { name: IconName; size?: number; class?: string } = $props();
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width="1.75"
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
	class="shrink-0 {className}"
>
	{#if name === 'arrow-right'}
		<path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
	{:else if name === 'mail'}
		<rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" />
	{:else if name === 'external'}
		<path d="M15 3h6v6" /><path d="M10 14 21 3" />
		<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
	{:else if name === 'rss'}
		<path d="M4 11a9 9 0 0 1 9 9" /><path d="M4 4a16 16 0 0 1 16 16" /><circle
			cx="5"
			cy="19"
			r="1"
		/>
	{:else if name === 'pen'}
		<path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
	{:else if name === 'code'}
		<path d="m16 18 6-6-6-6" /><path d="m8 6-6 6 6 6" />
	{:else if name === 'file'}
		<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" />
		<path d="M8 13h8" /><path d="M8 17h5" />
	{/if}
</svg>

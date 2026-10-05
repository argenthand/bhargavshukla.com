<script lang="ts">
	// The easter eggs' one-line message (#63, #111): the Konami code, 8-bit mode and the palette
	// disco show it with `showToast` (toast.svelte.ts). The layout renders it once (#143). A
	// `role="status"`, so screen readers hear it.
	import { toast } from '$lib/toast.svelte';
</script>

<p
	role="status"
	class={toast.message
		? 'pointer-events-none fixed inset-x-0 bottom-20 z-50 mx-auto w-fit animate-confirm bg-ink px-4 py-2 text-page motion-reduce:animate-none md:bottom-8 print:hidden eight-bit:font-pixel eight-bit:text-xs eight-bit:leading-relaxed'
		: 'sr-only'}
>
	{toast.message}
</p>

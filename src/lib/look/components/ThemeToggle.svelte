<script lang="ts">
	// Light / Dark / System (#80, TA-* on the canvas): one button showing all three; each press moves
	// to the next (light → dark → system) and the highlight slides there. Its position and the
	// selected icon come from `data-theme-pref` on <html> (theme-toggle-* in src/styles/utilities.css), which the
	// inline script sets before the first paint, so it's right from the start. JavaScript only.
	import { Icon } from '$lib/site';
	import { look, nextTheme, THEMES, type Theme } from '../look.svelte';

	const LABELS: Record<Theme, string> = { light: 'Light', dark: 'Dark', system: 'System' };
	const ICONS = { light: 'sun', dark: 'moon', system: 'monitor' } as const;

	const cycle = () => look.setTheme(nextTheme(look.theme));
</script>

<button
	type="button"
	onclick={cycle}
	aria-label="Theme: {LABELS[look.theme]}. Switch to {LABELS[nextTheme(look.theme)]}"
	title="Theme: {LABELS[look.theme]}"
	class="relative hidden items-center rounded-full bg-fill p-1 js:flex"
>
	<span aria-hidden="true" class="absolute top-1 left-1 size-9 theme-toggle-thumb"></span>
	{#each THEMES as theme (theme)}
		<span
			data-option={theme}
			class="relative flex size-9 items-center justify-center theme-toggle-option"
		>
			<Icon name={ICONS[theme]} size={18} />
		</span>
	{/each}
</button>

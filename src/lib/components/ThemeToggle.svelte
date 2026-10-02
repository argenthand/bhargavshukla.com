<script lang="ts">
	// Light / Dark / System (#80, TA-* on the canvas): one button showing all three; each press moves
	// to the next (light → dark → system) and the highlight slides there. Its position and the
	// selected icon come from `data-theme-pref` on <html> (theme-toggle-* in layout.css), which the
	// inline script sets before the first paint, so it's right from the start. JavaScript only.
	import Icon from '$lib/components/Icon.svelte';
	import { isTheme, nextTheme, setTheme, THEMES, type ThemePref } from '$lib/theme';

	const LABELS: Record<ThemePref, string> = { light: 'Light', dark: 'Dark', system: 'System' };
	const ICONS = { light: 'sun', dark: 'moon', system: 'monitor' } as const;

	let pref = $state<ThemePref>('system');
	$effect(() => {
		const saved = document.documentElement.dataset.themePref;
		if (isTheme(saved)) pref = saved;
	});

	function cycle() {
		pref = nextTheme(pref);
		setTheme(pref);
	}
</script>

<button
	type="button"
	onclick={cycle}
	aria-label="Theme: {LABELS[pref]}. Switch to {LABELS[nextTheme(pref)]}"
	title="Theme: {LABELS[pref]}"
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

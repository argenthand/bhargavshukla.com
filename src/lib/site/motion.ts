// Motion that follows the reader's preference (docs/design.md → Motion): whether to animate at all,
// and how long for. Page and title transitions are in transitions.ts.

/** True when the reader asked for reduced motion: nothing animates then (docs/design.md → Motion). */
export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * `--duration-motion` in milliseconds for Svelte transitions (fade, flip), which take numbers
 * rather than CSS values; 0 with reduced motion. Browser only.
 */
export function motionMs(): number {
	if (reducedMotion()) return 0;
	const value = getComputedStyle(document.documentElement).getPropertyValue('--duration-motion');
	return parseFloat(value) * (value.trim().endsWith('ms') ? 1 : 1000) || 0;
}

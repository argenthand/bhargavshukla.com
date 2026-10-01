// Page transitions (#60): a title that appears in a list and as its own page's heading shares one
// view-transition-name, so it moves between the two instead of fading. Names must be unique on a page.
export const titleTransition = (kind: 'post' | 'aside', slug: string) => `${kind}-title-${slug}`;

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

// The home intro's heading (#59, #144): it's the name, so on home the header leaves the name out
// while the heading is on screen and fades it in once the heading scrolls under the sticky phone
// bar. The heading reports where it is (`{@attach watchIntro}`, via ProfileHeader's `intro`); the
// layout reads `introHeading.inView`. It starts true, so the server renders home without the name.

export const introHeading = $state({ inView: true });

/** Watches the heading; it counts as out of view once it's under the top bar (`data-top-bar`). */
export function watchIntro(heading: HTMLElement): () => void {
	const bar = document.querySelector('[data-top-bar]')?.getBoundingClientRect().height ?? 0;
	const observer = new IntersectionObserver(
		([observed]) => (introHeading.inView = observed.isIntersecting),
		{ rootMargin: `-${bar}px 0px 0px 0px` }
	);
	observer.observe(heading);
	return () => {
		observer.disconnect();
		introHeading.inView = true;
	};
}

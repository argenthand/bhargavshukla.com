// The home intro's heading (#59, #144): it's the name, so on home the header leaves the name out
// while the heading is on screen and fades it in once the heading scrolls under the sticky phone
// bar. The heading reports where it is (`{@attach watchIntro}`, via ProfileHeader's `intro`); the
// layout reads `intro.inView`. It starts true, so the server renders home without the name too.

/** The sticky phone bar's height (`h-14`): a heading under it is out of view. */
const STICKY_BAR = '-56px';

export const intro = $state({ inView: true });

export function watchIntro(heading: HTMLElement): () => void {
	const observer = new IntersectionObserver(([entry]) => (intro.inView = entry.isIntersecting), {
		rootMargin: `${STICKY_BAR} 0px 0px 0px`
	});
	observer.observe(heading);
	return () => {
		observer.disconnect();
		intro.inView = true;
	};
}

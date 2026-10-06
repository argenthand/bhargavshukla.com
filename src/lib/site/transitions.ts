import type { OnNavigate } from '@sveltejs/kit';
import { reducedMotion } from './motion';

// Page transitions (#60): a title that appears in a list and as its own page's heading shares one
// view-transition-name, so it moves between the two instead of fading. Names must be unique on a page.
export const titleTransition = (kind: 'post' | 'aside', slug: string) => `${kind}-title-${slug}`;

/** Pages that are one entry: a title moves between these and the lists that link to them. */
const ENTRY_ROUTES = ['/blog/[slug]', '/asides/[slug]'];

/** A title moves only between a list and an entry (Writing → post, Asides → aside, and back). */
export function movesTitles(from?: string | null, to?: string | null): boolean {
	return ENTRY_ROUTES.includes(from ?? '') !== ENTRY_ROUTES.includes(to ?? '');
}

/**
 * The layout's `onNavigate(pageTransition)` (#60, #144): a short cross-fade between pages, with
 * titles moving where `movesTitles` says; between two lists the page just fades. Skipped where the
 * browser has no View Transitions, with reduced motion, and for query-only changes (filters).
 */
export function pageTransition(navigation: OnNavigate): Promise<void> | undefined {
	if (!document.startViewTransition || reducedMotion()) return;
	if (navigation.from?.url.pathname === navigation.to?.url.pathname) return;
	const root = document.documentElement;
	const plain = !movesTitles(navigation.from?.route.id, navigation.to?.route.id);
	root.toggleAttribute('data-plain-transition', plain);
	return new Promise((done) => {
		const transition = document.startViewTransition(async () => {
			done();
			await navigation.complete;
		});
		transition.finished.finally(() => root.removeAttribute('data-plain-transition'));
	});
}

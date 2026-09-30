// Dates as the design shows them ("September 22, 2026"), always in UTC so a date-only value
// like displayDate "2026-08-15" never shifts a day with the server's or reader's timezone.

import type { PostSummary } from '$lib/types/content';

const long = new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' });

/** The publish date readers see: the backdate override if set. ISO, so it sorts as a string. */
export const shownDate = (post: Pick<PostSummary, 'displayDate' | 'publishedAt'>) =>
	post.displayDate ?? post.publishedAt;

export const formatDate = (iso: string) => long.format(new Date(iso));

/** `YYYY-MM-DD` for `<time datetime>`. */
export const isoDay = (iso: string) => new Date(iso).toISOString().slice(0, 10);

export const yearOf = (iso: string) => new Date(iso).getUTCFullYear();

/** "Updated …" shows only when the edit falls on a different calendar day from the shown date. */
export const updatedDate = (
	post: Pick<PostSummary, 'displayDate' | 'publishedAt' | 'updatedAt'>
) => (isoDay(post.updatedAt) > isoDay(shownDate(post)) ? post.updatedAt : undefined);

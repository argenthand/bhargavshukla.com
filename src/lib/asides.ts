// Asides (#18): kinds and their labels, shared by the pages and the server.

import type { AsideKind } from '$lib/types/content';

export const KINDS: { value: AsideKind; label: string; plural: string }[] = [
	{ value: 'code', label: 'Code', plural: 'Code' },
	{ value: 'quote', label: 'Quote', plural: 'Quotes' },
	{ value: 'tip', label: 'Tip', plural: 'Tips' },
	{ value: 'thought', label: 'Thought', plural: 'Thoughts' }
];

export const kindLabel = (kind: AsideKind) => KINDS.find((k) => k.value === kind)?.label ?? kind;

export const isKind = (value: string | null): value is AsideKind =>
	KINDS.some((k) => k.value === value);

/** Asides per page on /asides. */
export const PAGE_SIZE = 20;

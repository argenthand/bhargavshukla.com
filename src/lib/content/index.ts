// The content domain's interface. Import from here, not from the files behind it.
export { isKind, kindLabel, KINDS, PAGE_SIZE } from './asides';
export { default as AsideItem } from './components/AsideItem.svelte';
export { default as NextUp } from './components/NextUp.svelte';
export { default as PostMeta } from './components/PostMeta.svelte';
export { profileContacts, default as ProfileHeader } from './components/ProfileHeader.svelte';
export { default as Prose } from './components/Prose.svelte';
export { default as Toc } from './components/Toc.svelte';
export { formatDate, formatMonth, isoDay, shownDate, updatedDate, yearOf } from './format';
export type { Category, PostSummary } from './types';

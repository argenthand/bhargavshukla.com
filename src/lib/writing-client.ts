// Browser behaviour for the Writing list: search, filter, sort and paging without a reload.
// It runs the same list functions as the build (src/content/list.ts), so the two cannot disagree.
import { listPosts, parseListQuery, serializeListQuery, updateListQuery, type ListQuery } from '../content/list';
import { formatDate } from './format-date';

interface ClientPost {
  slug: string;
  title: string;
  publishDate: string;
  category: { id: string; name: string };
}

interface WritingData {
  posts: ClientPost[];
  categories: { id: string; name: string }[];
  pageSize: number;
}

const SEARCH_DEBOUNCE_MS = 300;

const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const form = element<HTMLFormElement>('writing-controls');
const searchInput = element<HTMLInputElement>('writing-q');
const categorySelect = element<HTMLSelectElement>('writing-category');
const sortSelect = element<HTMLSelectElement>('writing-sort');
const results = element<HTMLDivElement>('writing-results');
const status = element<HTMLParagraphElement>('writing-status');
const data: WritingData = JSON.parse(element('writing-data').textContent!);
const categoryIds = data.categories.map((category) => category.id);

/** The list's state as the current URL describes it: /writing/page/<n> or /writing?q=...&page=<n>. */
function queryFromLocation(): ListQuery {
  const query = parseListQuery(location.search, { categoryIds });
  const staticPage = /^\/writing\/page\/(\d+)\/?$/.exec(location.pathname);
  return staticPage ? { ...query, page: Number(staticPage[1]) } : query;
}

let query = queryFromLocation();
let searchTimer: ReturnType<typeof setTimeout> | undefined;

function hrefFor(next: ListQuery): string {
  return `/writing${serializeListQuery(next)}`;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function link(href: string, label: string, page?: number): HTMLAnchorElement {
  const anchor = el('a', undefined, label);
  anchor.href = href;
  if (page !== undefined) anchor.dataset.page = String(page);
  return anchor;
}

const rangeText = (first: number, last: number) => (first === last ? `${first}` : `${first}–${last}`);

function render(): { total: number; summary: string } {
  const list = listPosts(data.posts, query, { pageSize: data.pageSize });
  if (list.page !== query.page) {
    // The URL named a page past the end: show the last page and correct the URL to match.
    query = { ...query, page: list.page };
    history.replaceState(null, '', hrefFor(query));
  }

  if (list.total === 0) {
    const clear = el('button', 'clear-filters', 'Clear filters');
    clear.type = 'button';
    results.replaceChildren(el('p', undefined, 'No posts match.'), clear);
    return { total: 0, summary: 'No posts match.' };
  }

  const summary = `${rangeText(list.firstItem, list.lastItem)} of ${list.total}`;
  const rows = el('ol', 'post-list');
  for (const post of list.items) {
    const row = el('li');
    const date = el('time', 'eyebrow', formatDate(post.publishDate));
    date.dateTime = post.publishDate;
    const title = link(`/writing/${post.slug}`, post.title);
    title.className = 'post-title';
    row.append(date, title, el('span', 'eyebrow', post.category.name));
    rows.append(row);
  }

  const nodes: Node[] = [el('p', 'eyebrow', summary), rows];
  if (list.pageCount > 1) {
    const nav = el('nav', 'pagination');
    nav.setAttribute('aria-label', 'Pagination');
    if (list.page > 1) {
      const previous = link(hrefFor(updateListQuery(query, { page: list.page - 1 })), '← Previous', list.page - 1);
      previous.rel = 'prev';
      nav.append(previous);
    }
    const numbers = el('ul');
    for (let n = 1; n <= list.pageCount; n++) {
      const item = el('li');
      const anchor = link(hrefFor(updateListQuery(query, { page: n })), '', n);
      anchor.append(el('span', 'sr-only', 'Page '), String(n));
      if (n === list.page) anchor.setAttribute('aria-current', 'page');
      item.append(anchor);
      numbers.append(item);
    }
    nav.append(numbers);
    if (list.page < list.pageCount) {
      const next = link(hrefFor(updateListQuery(query, { page: list.page + 1 })), 'Next →', list.page + 1);
      next.rel = 'next';
      nav.append(next);
    }
    nodes.push(nav);
  }
  results.replaceChildren(...nodes);
  return { total: list.total, summary: `Showing ${summary} ${list.total === 1 ? 'post' : 'posts'}` };
}

function syncControls() {
  searchInput.value = query.q;
  categorySelect.value = query.category ?? '';
  sortSelect.value = query.sort;
}

function show(announce: boolean) {
  const { summary } = render();
  if (announce) {
    // Clear first so an identical message (for example after changing the sort) is announced again.
    status.textContent = '';
    requestAnimationFrame(() => (status.textContent = summary));
  }
}

/** Move to a new state, adding a history entry so the back button returns to the previous one. */
function go(next: ListQuery) {
  // Whatever the user did, a pending search is now stale.
  clearTimeout(searchTimer);
  if (hrefFor(next) === hrefFor(query) && location.pathname.replace(/\/$/, '') === '/writing') return;
  query = next;
  history.pushState(null, '', hrefFor(next));
  show(true);
}

searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => go(updateListQuery(query, { q: searchInput.value.trim() })), SEARCH_DEBOUNCE_MS);
});
form.addEventListener('submit', (event) => {
  event.preventDefault();
  clearTimeout(searchTimer);
  go(updateListQuery(query, { q: searchInput.value.trim() }));
});
categorySelect.addEventListener('change', () => go(updateListQuery(query, { category: categorySelect.value || null })));
sortSelect.addEventListener('change', () => go(updateListQuery(query, { sort: sortSelect.value === 'oldest' ? 'oldest' : 'newest' })));

results.addEventListener('click', (event) => {
  const target = event.target as HTMLElement;
  const pageLink = target.closest<HTMLAnchorElement>('a[data-page]');
  if (pageLink && !(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0)) {
    event.preventDefault();
    go(updateListQuery(query, { page: Number(pageLink.dataset.page) }));
    syncControls();
    // The paging links were replaced, so keep keyboard users in the list.
    results.focus();
  } else if (target.closest('.clear-filters')) {
    go(updateListQuery(query, { q: '', category: null }));
    syncControls();
    searchInput.focus();
  }
});

window.addEventListener('popstate', () => {
  clearTimeout(searchTimer);
  query = queryFromLocation();
  syncControls();
  show(true);
});

syncControls();
form.hidden = false;
// The server already rendered the page the URL names; only replace it when the URL carries a query.
if (location.search !== '') show(false);

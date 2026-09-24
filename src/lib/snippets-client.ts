// Browser behaviour for /snippets: copy code, copy a Snippet's link, expand long Snippets and
// reveal the Snippet named by the URL. Without JavaScript every Snippet is simply shown in full.
import { copyWithFeedback } from './copy';

const status = document.getElementById('snippet-status');
const HIGHLIGHT_MS = 2000;
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const snippets = Array.from(document.querySelectorAll<HTMLElement>('.snippet'));

function setCollapsed(snippet: HTMLElement, collapsed: boolean) {
  const toggle = snippet.querySelector<HTMLButtonElement>('.snippet-toggle');
  if (!toggle) return;
  if (collapsed) snippet.dataset.collapsed = 'true';
  else delete snippet.dataset.collapsed;
  toggle.setAttribute('aria-expanded', String(!collapsed));
  toggle.querySelector('.snippet-toggle-icon')!.textContent = collapsed ? '+' : '−';
}

for (const snippet of snippets) {
  const code = snippet.querySelector<HTMLPreElement>('pre');
  const copy = snippet.querySelector<HTMLButtonElement>('[data-copy]');
  const title = snippet.querySelector<HTMLAnchorElement>('.snippet-title-link');
  const toggle = snippet.querySelector<HTMLButtonElement>('.snippet-toggle');

  if (copy && code) {
    copy.hidden = false;
    copy.addEventListener('click', () =>
      copyWithFeedback({
        text: code.textContent ?? '',
        button: copy,
        status,
        idleLabel: 'Copy',
        doneLabel: 'Copied',
        message: `Copied ${title?.dataset.title ?? 'code'}`,
        failMessage: 'Could not copy the code',
      }),
    );
  }

  if (toggle) {
    toggle.hidden = false;
    toggle.addEventListener('click', () => setCollapsed(snippet, snippet.dataset.collapsed !== 'true'));
  }

  // The title is a link to the Snippet; with JavaScript, using it also copies the link.
  title?.addEventListener('click', async (event) => {
    // Leave open-in-new-tab and similar clicks to the browser.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    const url = `${location.origin}${location.pathname}#${snippet.id}`;
    history.replaceState(null, '', `#${snippet.id}`);
    try {
      await navigator.clipboard.writeText(url);
      announce(`Link to ${title.dataset.title} copied`);
    } catch {
      announce('Could not copy the link');
    }
  });
}

function announce(message: string) {
  if (!status) return;
  status.textContent = '';
  requestAnimationFrame(() => (status.textContent = message));
}

let highlightTimer: ReturnType<typeof setTimeout> | undefined;

/** Scroll to the Snippet named by the URL fragment, expand it and highlight it briefly. */
function reveal() {
  let id = location.hash.slice(1);
  try {
    id = decodeURIComponent(id);
  } catch {
    // A malformed escape: use the fragment as written.
  }
  const snippet = snippets.find((candidate) => candidate.id === id);
  if (!snippet) return;

  setCollapsed(snippet, false);
  snippet.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
  snippet.focus({ preventScroll: true });

  clearTimeout(highlightTimer);
  document.querySelector('.snippet.is-highlighted')?.classList.remove('is-highlighted');
  snippet.classList.add('is-highlighted');
  highlightTimer = setTimeout(() => snippet.classList.remove('is-highlighted'), HIGHLIGHT_MS);
}

window.addEventListener('hashchange', reveal);
reveal();

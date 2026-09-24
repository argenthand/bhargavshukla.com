const resetTimers = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();
const RESET_MS = 2000;

/** Copy text, then confirm it on the button and in a polite live region for screen readers. */
export async function copyWithFeedback(options: {
  text: string;
  button: HTMLElement;
  status: HTMLElement | null;
  idleLabel: string;
  doneLabel: string;
  message: string;
  failMessage: string;
}) {
  const { button, status } = options;
  let ok = true;
  try {
    await navigator.clipboard.writeText(options.text);
  } catch {
    ok = false;
  }
  button.textContent = ok ? options.doneLabel : 'Copy failed';
  const message = ok ? options.message : options.failMessage;
  if (status) {
    // Clear first so repeating the same message is announced again.
    status.textContent = '';
    requestAnimationFrame(() => (status.textContent = message));
  }
  clearTimeout(resetTimers.get(button));
  resetTimers.set(
    button,
    setTimeout(() => {
      button.textContent = options.idleLabel;
      // Leave the live region alone if something else has announced since.
      if (status && status.textContent === message) status.textContent = '';
    }, RESET_MS),
  );
}

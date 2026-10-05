// The one-line message at the bottom of the screen (#63, #111): the Konami code, 8-bit mode and the
// palette disco use it. Toast.svelte renders it (#143).

/** How long a message stays up. */
export const TOAST_MS = 3000;

export const toast = $state({ message: '' });

let timer: ReturnType<typeof setTimeout>;

export function showToast(message: string, ms = TOAST_MS) {
	toast.message = message;
	clearTimeout(timer);
	timer = setTimeout(() => (toast.message = ''), ms);
}

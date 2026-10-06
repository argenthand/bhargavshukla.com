// Cloudflare Turnstile for the contact card (#135, docs/contact.md). The script loads the first
// time someone focuses the form, never with the page, so visitors who only read don't download it.

const SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

/** Turnstile's documented test site key: always passes. Used under `vite dev`. */
export const TEST_SITE_KEY = '1x00000000000000000000AA';

export interface TurnstileOptions {
	sitekey: string;
	appearance?: 'always' | 'execute' | 'interaction-only';
	theme?: 'auto' | 'light' | 'dark';
	'response-field'?: boolean;
	'refresh-expired'?: 'auto' | 'manual' | 'never';
	callback?: (token: string) => void;
	'expired-callback'?: () => void;
	'error-callback'?: () => void;
}

export interface Turnstile {
	render(container: HTMLElement, options: TurnstileOptions): string;
	reset(widgetId: string): void;
}

declare global {
	interface Window {
		turnstile?: Turnstile;
	}
}

let loading: Promise<Turnstile> | undefined;

export function loadTurnstile(): Promise<Turnstile> {
	loading ??= new Promise((resolve, reject) => {
		const script = document.createElement('script');
		script.src = SRC;
		script.async = true;
		script.onload = () =>
			window.turnstile ? resolve(window.turnstile) : reject(new Error('Turnstile: no API'));
		script.onerror = () => {
			// Blocked or offline: allow another try on the next focus.
			loading = undefined;
			reject(new Error('Turnstile: script failed to load'));
		};
		document.head.append(script);
	});
	return loading;
}

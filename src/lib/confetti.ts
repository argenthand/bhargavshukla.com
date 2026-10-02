// The Konami code's reward (#63): one short burst of confetti in the visitor's palette (#81) and
// theme (#80). Loaded with a dynamic import only when someone types the code, so neither this nor
// canvas-confetti costs anything otherwise. The caller skips it under reduced motion.

import canvasConfetti from 'canvas-confetti';

// Palette shades per theme, matching the accent (--hue-700 in light, --hue-400 in dark) plus a grey.
const SHADES = {
	light: ['--hue-700', '--hue-500', '--hue-300', '--grey-500'],
	dark: ['--hue-400', '--hue-300', '--hue-500', '--grey-400']
};
const DURATION_MS = 2500;

/** canvas-confetti only reads hex, and CSS variables resolve to oklch(), so go through a canvas. */
function resolveColors(vars: string[]): string[] {
	const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
	if (!ctx) return [];
	const probe = document.createElement('span');
	document.body.append(probe);
	const colors = vars.map((name) => {
		probe.style.color = `var(${name})`;
		ctx.clearRect(0, 0, 1, 1);
		ctx.fillStyle = getComputedStyle(probe).color;
		ctx.fillRect(0, 0, 1, 1);
		const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
		return `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
	});
	probe.remove();
	return colors;
}

export function confetti() {
	// The inline script in app.html sets data-theme before first paint; fall back to the system.
	const theme =
		document.documentElement.dataset.theme ??
		(matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
	const colors = resolveColors(SHADES[theme === 'dark' ? 'dark' : 'light']);

	const end = Date.now() + DURATION_MS;
	const shoot = () => {
		const options = { particleCount: 6, spread: 70, startVelocity: 55, colors, zIndex: 50 };
		canvasConfetti({ ...options, angle: 60, origin: { x: 0, y: 0.8 } });
		canvasConfetti({ ...options, angle: 120, origin: { x: 1, y: 0.8 } });
		if (Date.now() < end) requestAnimationFrame(shoot);
	};
	shoot();
}

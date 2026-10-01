// The Konami code's reward (#63): one short burst of accent-red paper squares. Loaded with a
// dynamic import only when someone types the code, so it costs nothing otherwise. The caller skips
// it under reduced motion. Transform and opacity only; everything is removed when it ends.

const PIECES = 3200;
const DURATION_MS = 2500;
const COLORS = ['--color-red-700', '--color-red-500', '--color-red-300', '--color-neutral-500'];

export function confetti() {
	const layer = document.createElement('div');
	layer.setAttribute('aria-hidden', 'true');
	layer.style.cssText = 'position:fixed;inset:0;overflow:hidden;pointer-events:none;z-index:50';
	document.body.append(layer);

	const falls = Array.from({ length: PIECES }, () => {
		const piece = document.createElement('span');
		const size = 6 + Math.random() * 6;
		const color = COLORS[Math.floor(Math.random() * COLORS.length)];
		piece.style.cssText = `position:absolute;top:0;left:${Math.random() * 100}%;width:${size}px;height:${size * 0.6}px;background:var(${color})`;
		layer.append(piece);
		const drift = (Math.random() - 0.5) * 240;
		const spin = (Math.random() - 0.5) * 1440;
		return piece.animate(
			[
				{ transform: 'translate(0, -5vh) rotate(0deg)', opacity: 1 },
				{ transform: `translate(${drift}px, 105vh) rotate(${spin}deg)`, opacity: 0.6 }
			],
			{
				duration: DURATION_MS * (0.7 + Math.random() * 0.6),
				delay: Math.random() * 300,
				easing: 'cubic-bezier(0.2, 0.6, 0.4, 1)',
				fill: 'forwards'
			}
		).finished;
	});

	Promise.allSettled(falls).then(() => layer.remove());
}

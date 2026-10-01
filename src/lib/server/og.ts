// Share cards (#62, F-og-*): 1200×630 PNGs for link previews, drawn with satori (layout → SVG) and
// resvg (SVG → PNG) on the Worker. A post's cover still wins in <Seo>; these cover everything else.
//
// satori is pinned to 0.32: from 0.33 it shapes text with harfbuzzjs, which loads its WebAssembly
// in a way Workers refuse. Rendering takes ~20–70 ms of CPU, more than the Workers Free plan's
// 10 ms, so the site is on Workers Paid (docs/infrastructure.md).

import { dev } from '$app/environment';
import { Resvg, initWasm } from '@resvg/resvg-wasm';
import satori, { init } from 'satori/standalone';
import regular from '@fontsource/newsreader/files/newsreader-latin-400-normal.woff?inline';
import italic from '@fontsource/newsreader/files/newsreader-latin-400-italic.woff?inline';
import semibold from '@fontsource/newsreader/files/newsreader-latin-600-normal.woff?inline';
import { CARD } from '$lib/share';
import { site } from '$lib/site';

const COLORS = { red: '#b91c1c', text: '#171717', muted: '#525252', avatar: '#d4d4d4' };

/** A satori node: the same shape as a React element, without React. */
type Node = {
	type: string;
	props: { style?: Record<string, unknown>; children?: unknown; [k: string]: unknown };
};
const el = (
	type: string,
	style: Record<string, unknown>,
	children?: unknown,
	extra = {}
): Node => ({
	type,
	props: { style, children, ...extra }
});

const label = (text: string) =>
	el(
		'span',
		{
			fontSize: 22,
			fontWeight: 600,
			letterSpacing: '0.14em',
			textTransform: 'uppercase',
			color: COLORS.red
		},
		text
	);

const avatar = (src: string | undefined, size: number) =>
	src
		? el('img', { width: size, height: size, borderRadius: 9999, objectFit: 'cover' }, undefined, {
				src,
				width: size,
				height: size
			})
		: undefined;

const byline = (photo: string | undefined, right: string) =>
	el('div', { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24 }, [
		el('div', { display: 'flex', alignItems: 'center', gap: 16 }, [
			avatar(photo, 64),
			el('span', { fontSize: 30, fontWeight: 600, letterSpacing: '-0.01em' }, site.name)
		]),
		el('span', { fontSize: 26, color: COLORS.muted }, right)
	]);

/** The frame every card shares: white, a red rule along the top, content top and bottom. */
const frame = (top: Node, bottom: Node) =>
	el(
		'div',
		{
			width: CARD.width,
			height: CARD.height,
			display: 'flex',
			flexDirection: 'column',
			justifyContent: 'space-between',
			padding: '72px 80px 64px',
			background: '#ffffff',
			borderTop: `12px solid ${COLORS.red}`,
			fontFamily: 'Newsreader',
			color: COLORS.text
		},
		[top, bottom]
	);

/** Long titles get a smaller size; past three lines, satori cuts them with an ellipsis. */
export const titleSize = (title: string) => (title.length > 70 ? 60 : 72);

export function postCard(post: {
	title: string;
	category?: string | null;
	date: string;
	photo?: string;
}): Node {
	return frame(
		el('div', { display: 'flex', flexDirection: 'column', gap: 24 }, [
			post.category ? label(post.category) : undefined,
			el(
				'div',
				{
					fontSize: titleSize(post.title),
					lineHeight: 1.1,
					fontWeight: 600,
					letterSpacing: '-0.02em',
					lineClamp: 3
				},
				post.title
			)
		]),
		byline(post.photo, `${post.date} · ${new URL(site.url).host}`)
	);
}

export function asideCard(aside: {
	kind: string;
	text: string;
	quote: boolean;
	attribution?: string | null;
	photo?: string;
}): Node {
	return frame(
		el('div', { display: 'flex', flexDirection: 'column', gap: 28 }, [
			label(aside.kind),
			el(
				'div',
				{
					fontSize: 56,
					lineHeight: 1.2,
					fontStyle: aside.quote ? 'italic' : 'normal',
					lineClamp: 4
				},
				aside.quote ? `“${aside.text}”` : aside.text
			),
			aside.attribution
				? el('span', { fontSize: 28, color: COLORS.muted }, `— ${aside.attribution}`)
				: undefined
		]),
		byline(aside.photo, `Asides · ${new URL(site.url).host}`)
	);
}

export function defaultCard(profile: { name: string; tagline: string; photo?: string }): Node {
	return frame(
		el('div', { display: 'flex', flexDirection: 'column', gap: 20 }, [
			el(
				'div',
				{ fontSize: 96, lineHeight: 1.05, fontWeight: 600, letterSpacing: '-0.02em' },
				profile.name
			),
			el('div', { fontSize: 40, fontStyle: 'italic', color: COLORS.muted }, profile.tagline)
		]),
		el('div', { display: 'flex', alignItems: 'center', justifyContent: 'space-between' }, [
			avatar(profile.photo, 96) ?? el('div', {}),
			el('span', { fontSize: 26, color: COLORS.muted }, new URL(site.url).host)
		])
	);
}

/** A `?inline` font (a base64 data URL) as bytes. */
function decode(dataUrl: string): ArrayBuffer {
	const text = atob(dataUrl.split(',')[1]);
	const bytes = new Uint8Array(text.length);
	for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i);
	return bytes.buffer;
}
let fonts: { name: string; data: ArrayBuffer; weight: 400 | 600; style: 'normal' | 'italic' }[];

/**
 * The two WebAssembly modules, loaded once per isolate. On Workers they must be imported as
 * modules (wrangler bundles them; vite.config.ts leaves `.wasm` imports external); `vite dev` runs
 * on Node, which compiles them from the files instead.
 */
let ready: Promise<unknown> | undefined;
function loadWasm() {
	ready ??= dev
		? Promise.all([
				import('node:fs/promises').then(async ({ readFile }) => {
					const { createRequire } = await import('node:module');
					const require = createRequire(import.meta.url);
					await init(
						await WebAssembly.compile(await readFile(require.resolve('satori/yoga.wasm')))
					);
					await initWasm(readFile(require.resolve('@resvg/resvg-wasm/index_bg.wasm')));
				})
			])
		: Promise.all([
				// Typed as URLs by Vite; on Workers they are WebAssembly modules.
				import('satori/yoga.wasm').then((m) => init(m.default as unknown as WebAssembly.Module)),
				import('@resvg/resvg-wasm/index_bg.wasm').then((m) =>
					initWasm(m.default as unknown as WebAssembly.Module)
				)
			]);
	return ready;
}

export async function renderCard(card: Node): Promise<Uint8Array<ArrayBuffer>> {
	await loadWasm();
	fonts ??= [
		{ name: 'Newsreader', data: decode(regular), weight: 400, style: 'normal' },
		{ name: 'Newsreader', data: decode(italic), weight: 400, style: 'italic' },
		{ name: 'Newsreader', data: decode(semibold), weight: 600, style: 'normal' }
	];
	// satori's types expect a React element; this object has the same shape.
	const svg = await satori(card as unknown as Parameters<typeof satori>[0], { ...CARD, fonts });
	return new Resvg(svg).render().asPng() as Uint8Array<ArrayBuffer>;
}

/**
 * A PNG response; the edge cache stores it like a page (tagged by the content it read). `degraded`
 * (the profile couldn't be loaded) keeps a card without the name and headshot out of the cache.
 */
export const pngResponse = (png: Uint8Array<ArrayBuffer>, degraded = false) =>
	new Response(png, {
		headers: { 'content-type': 'image/png', ...(degraded && { 'cache-control': 'no-store' }) }
	});

/** The profile for a card, or `degraded` when Strapi couldn't be reached. */
export async function cardProfile<T>(
	load: Promise<T>
): Promise<{ profile?: T; degraded: boolean }> {
	try {
		return { profile: await load, degraded: false };
	} catch (err) {
		console.error('Share card: profile unavailable', err);
		return { degraded: true };
	}
}

/** The smallest copy of the headshot that's still sharp at 96 px (cards use 64–96 px). */
export function headshotSrc(photo: { src: string; srcset?: string } | null | undefined) {
	if (!photo) return undefined;
	const sizes = (photo.srcset ?? '')
		.split(', ')
		.map((entry) => entry.split(' '))
		.map(([url, w]) => ({ url, width: parseInt(w) }))
		.filter((s) => s.url && s.width >= 192);
	return sizes[0]?.url ?? photo.src;
}

/**
 * The headshot as a data URL, fetched here rather than by satori: a missing or broken image just
 * leaves it off the card instead of failing it.
 */
export async function loadHeadshot(src: string | undefined): Promise<string | undefined> {
	if (!src) return undefined;
	try {
		const res = await fetch(src);
		const type = res.headers.get('content-type') ?? '';
		if (!res.ok || !/^image\/(jpeg|png)/.test(type)) return undefined;
		const bytes = new Uint8Array(await res.arrayBuffer());
		let binary = '';
		for (let i = 0; i < bytes.length; i += 0x8000) {
			binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
		}
		return `data:${type.split(';')[0]};base64,${btoa(binary)}`;
	} catch (err) {
		console.error('Share card: headshot unavailable', err);
		return undefined;
	}
}

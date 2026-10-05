#!/usr/bin/env node
// The resume's printed note (#102), one SVG per palette in static/print-notes/:
// "Printed in <Palette> from bhargavshukla.com/resume. Thanks for reading it on paper."
// Drawn as outlines (satori turns text into paths), so readers see it on paper and in the PDF
// while ATS parsers, which read the PDF's text, never do. The palette's name is in its light-mode
// accent (-700) and the rest in its grey-500, the same colours the page prints with, in the
// palette's own typeface (#114).
//
//   pnpm print-notes     # after changing the wording, a palette, its colours or its font

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import satori from 'satori';
import { PALETTES } from '../src/lib/palettes.ts';
import { site } from '../src/lib/site.ts';

const OUT = 'static/print-notes';
const SIZE = 12; // px: the footer's text-xs
const WIDTH = 640; // wider than the text; the SVG is cropped to it below

const theme = readFileSync('node_modules/tailwindcss/theme.css', 'utf8');
const palettes = readFileSync('src/styles/palettes.css', 'utf8');

/** A palette's family for `--grey-500` or `--hue-700`, from its block in src/styles/palettes.css. */
function family(palette, role) {
	const block = palettes.match(new RegExp(`\\[data-palette='${palette}'\\]\\s*\\{([^}]*)\\}`))?.[1];
	const name = block?.match(new RegExp(`--${role}:\\s*var\\(--color-([a-z]+)-`))?.[1];
	if (!name) throw new Error(`No --${role} for ${palette} in src/styles/palettes.css`);
	return name;
}

/** A palette's typeface (#114): the first family in its `--palette-font`, as Fontsource's static
 *  400 woff (satori reads woff, not woff2). */
function typeface(palette) {
	const block = palettes.match(
		new RegExp(`(?:\\[data-palette='${palette}'\\])\\s*\\{([^}]*)\\}`)
	)?.[1];
	const name = block?.match(/--palette-font:\s*'([^']+)'/)?.[1];
	if (!name) throw new Error(`No --palette-font for ${palette} in src/styles/palettes.css`);
	const slug = name.toLowerCase().replaceAll(' ', '-');
	return {
		name,
		data: readFileSync(`node_modules/@fontsource/${slug}/files/${slug}-latin-400-normal.woff`)
	};
}

/** Tailwind's oklch value → sRGB hex (satori doesn't read oklch). */
function hex(color) {
	const m = theme.match(
		new RegExp(`--color-${color}:\\s*oklch\\(([\\d.]+)%\\s+([\\d.]+)\\s+([\\d.]+|none)\\)`)
	);
	if (!m) throw new Error(`No --color-${color} in tailwindcss/theme.css`);
	const [L, C, h] = [
		Number(m[1]) / 100,
		Number(m[2]),
		m[3] === 'none' ? 0 : (Number(m[3]) * Math.PI) / 180
	];
	const [a, b] = [C * Math.cos(h), C * Math.sin(h)];
	const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
	const mm = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
	const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
	const linear = [
		4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * s,
		-1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * s,
		-0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * s
	];
	return `#${linear
		.map((c) => Math.min(1, Math.max(0, c)))
		.map((c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055))
		.map((c) =>
			Math.round(c * 255)
				.toString(16)
				.padStart(2, '0')
		)
		.join('')}`;
}

const span = (text, color) => ({
	type: 'span',
	props: { style: { color, whiteSpace: 'pre' }, children: text }
});

mkdirSync(OUT, { recursive: true });
for (const { id, label } of PALETTES) {
	const grey = hex(`${family(id, 'grey-500')}-500`);
	const accent = hex(`${family(id, 'hue-700')}-700`);
	const host = new URL(site.url).host;
	const font = typeface(id);
	const svg = await satori(
		{
			type: 'div',
			props: {
				style: { display: 'flex', fontFamily: font.name, fontSize: SIZE, lineHeight: 1.5 },
				children: [
					span('Printed in ', grey),
					span(label, accent),
					span(` from ${host}/resume.`, grey)
				]
			}
		},
		{
			width: WIDTH,
			height: SIZE * 1.5,
			fonts: [{ name: font.name, data: font.data, weight: 400, style: 'normal' }]
		}
	);
	// Crop the canvas to the drawn text, so the image's own width is the text's.
	const xs = [...svg.matchAll(/[ML]\s*([\d.]+)/g)].map((m) => Number(m[1]));
	const width = Math.ceil(Math.max(...xs)) + 1;
	const cropped = svg
		.replace(`width="${WIDTH}"`, `width="${width}"`)
		.replace(`viewBox="0 0 ${WIDTH} `, `viewBox="0 0 ${width} `);
	writeFileSync(`${OUT}/${id}.svg`, `${cropped}\n`);
	console.log(
		`${OUT}/${id}.svg  ${width}×${SIZE * 1.5}  ${label} in ${font.name}, ${accent} on ${grey}`
	);
}

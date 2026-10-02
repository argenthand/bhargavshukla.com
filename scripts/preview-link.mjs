#!/usr/bin/env node
// Draft preview on localhost (#98): prints the link Strapi's "Open preview" would open, signed with
// the LOCAL PREVIEW_SECRET (.env, or .env.<mode> when it sets one), never the production one.
// Same signed text as `linkPayload` in src/lib/server/preview.ts and `previewLink` in
// cms/config/admin.ts: keep the three in step.
//
//   pnpm preview-link /resume          # http://localhost:5173/api/preview?path=/resume&…
//   pnpm preview-link /blog/a-post 5199

import { createHmac } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/** Links last 5 minutes, like the CMS's (the site refuses anything over 10). */
export const LINK_TTL_S = 5 * 60;

/**
 * @param {string} origin e.g. http://localhost:5173
 * @param {string} path a site path, e.g. /resume
 * @param {string} secret PREVIEW_SECRET
 * @param {number} exp expiry, Unix seconds
 */
export function previewLink(origin, path, secret, exp) {
	const sig = createHmac('sha256', secret).update(`link\n${path}\n${exp}`).digest('hex');
	return `${origin}/api/preview?${new URLSearchParams({ path, exp: String(exp), sig })}`;
}

/**
 * The last PREVIEW_SECRET set across the env files, in the order Vite reads them.
 * @param {string} mode
 */
function localSecret(mode) {
	const lines = ['.env', `.env.${mode}`]
		.filter((file) => existsSync(file))
		.flatMap((file) => readFileSync(file, 'utf8').split('\n'));
	const values = lines
		.filter((line) => line.startsWith('PREVIEW_SECRET='))
		.map((line) =>
			line
				.slice('PREVIEW_SECRET='.length)
				.trim()
				.replace(/^["']|["']$/g, '')
		);
	return values.filter(Boolean).at(-1);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
	const [path = '/', port = '5173'] = process.argv.slice(2);
	if (!path.startsWith('/') || path.startsWith('//')) {
		console.error('Give a site path, e.g. /resume');
		process.exit(1);
	}
	const secret = localSecret('cms');
	if (!secret) {
		console.error('No PREVIEW_SECRET in .env or .env.cms (docs/infrastructure.md → Local dev)');
		process.exit(1);
	}
	const exp = Math.floor(Date.now() / 1000) + LINK_TTL_S;
	console.log(previewLink(`http://localhost:${port}`, path, secret, exp));
}

import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import tailwindcss from '@tailwindcss/vite';
import adapter from '@sveltejs/adapter-cloudflare';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},

			// Builds a Cloudflare Worker with Static Assets; see wrangler.jsonc and docs/infrastructure.md.
			adapter: adapter(),

			// All CSS goes inline in the HTML (#117): no stylesheet round trip before the first paint.
			// Client-side navigation never refetches the HTML, so only full page loads carry it.
			inlineStyleThreshold: Infinity
		})
	],
	// Share cards (#62): leave .wasm imports to wrangler, which bundles them as WebAssembly modules
	// (Workers can't compile WebAssembly from bytes at runtime). See src/lib/site/server/og.ts.
	build: { rollupOptions: { external: (id) => id.endsWith('.wasm') } },
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'client',
					browser: {
						enabled: true,
						provider: playwright(),
						instances: [{ browser: 'chromium', headless: true }],
						commands: {
							// Print checks (#147): render the page as for paper, or back to the screen with null.
							emulateMedia: (ctx, media: 'print' | 'screen' | null) =>
								ctx.page.emulateMedia({ media })
						}
					},
					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					exclude: ['src/lib/server/**']
				}
			},

			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});

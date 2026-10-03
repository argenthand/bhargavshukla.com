// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { ReadsDb } from '$lib/server/reads';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			/** `type:<model>` tags for the content this response reads (docs/caching.md). */
			cacheTags: Set<string>;
			/** A valid draft-preview cookie came with the request (#57): loads may read drafts. */
			preview: boolean;
			/** Set by a load whose result must not be edge-cached (#108), e.g. home without Strapi.
			 *  `setHeaders` can't do it: SvelteKit leaves it off `__data.json` responses. */
			noStore?: boolean;
		}
		// interface PageData {}
		// interface PageState {}
		interface Platform {
			/** Bindings from wrangler.jsonc. `READS` is D1 (#87); `vite dev` gets a local copy. */
			env: { READS?: ReadsDb };
		}
	}
}

export {};

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { EventsDataset } from '$lib/server/events';
import type { ReadsDb } from '$lib/server/reads';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			/** `type:<model>` tags for the content this response reads (docs/caching.md). */
			cacheTags: Set<string>;
			/** A valid draft-preview cookie came with the request (#57): loads may read drafts. */
			preview: boolean;
			/** Set by a load that showed the page without some of its content (#142, `degrade` in
			 *  src/lib/publishing/server/page-load.ts): never edge-cached, and a page request answers 503.
			 *  `setHeaders` can't do it: SvelteKit leaves it off `__data.json` responses. */
			degraded?: boolean;
		}
		// interface PageData {}
		// interface PageState {}
		interface Platform {
			/** Bindings from wrangler.jsonc. `READS` is D1 (#87); `vite dev` gets a local copy.
			 *  `CONTACT_RATE` limits contact-form sends per IP (#135). `EVENTS` is the analytics
			 *  events' Analytics Engine dataset (#154). */
			env: {
				READS?: ReadsDb;
				EVENTS?: EventsDataset;
				CONTACT_RATE?: { limit(options: { key: string }): Promise<{ success: boolean }> };
			};
		}
	}
}

export {};

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			/** `type:<model>` tags for the content this response reads (docs/caching.md). */
			cacheTags: Set<string>;
			/** A valid draft-preview cookie came with the request (#57): loads may read drafts. */
			preview: boolean;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};

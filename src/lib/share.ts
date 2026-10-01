// Share cards (#62): where they live and how big they are. Rendered by $lib/server/og.ts.
import { site } from '$lib/site';

export const CARD = { width: 1200, height: 630 } as const;

/**
 * The card's absolute URL for <Seo>. `v` changes when the content does, so share sites that cache
 * images by URL fetch the new card; the edge cache leaves it out of the key (docs/caching.md).
 */
export const cardUrl = (path: string, version?: string) =>
	`${site.url}/og${path}.png${version ? `?v=${encodeURIComponent(version)}` : ''}`;

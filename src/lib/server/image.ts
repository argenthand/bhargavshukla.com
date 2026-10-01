// Turns a shared.image component (#40) into what the page renders.

import { creditHref, responsive, SOURCE_NAMES } from '$lib/images';
import type { ImageField, ResolvedImage } from '$lib/types/content';
import { mediaUrl } from './strapi';

export function resolveImage(image: ImageField | null | undefined): ResolvedImage | null {
	if (!image) return null;
	if (image.file) {
		return {
			src: mediaUrl(image.file.url),
			alt: image.alt || image.file.alternativeText || '',
			width: image.file.width,
			height: image.file.height
		};
	}
	if (!image.url) return null;
	const source = image.source ?? 'other';
	return {
		...responsive(image.url),
		alt: image.alt ?? '',
		width: null,
		height: null,
		credit: image.creditName
			? {
					name: image.creditName,
					href: image.creditUrl ? creditHref(image.creditUrl, source) : null,
					source: SOURCE_NAMES[source],
					sourceHref: image.sourceUrl ? creditHref(image.sourceUrl, source) : null
				}
			: undefined
	};
}

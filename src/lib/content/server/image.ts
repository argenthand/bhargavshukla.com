// Turns a shared.image component (#40) into what the page renders.

import { creditHref, responsive, SOURCE_NAMES } from './images';
import type { ImageField, Media, ResolvedImage } from '../types';
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

/**
 * An upload with Strapi's resized copies as a srcset, so a small slot (the headshot) doesn't load
 * the original. R2 serves files as-is, so these copies are the only sizes there are.
 */
export function resolveUpload(media: Media | null | undefined): ResolvedImage | null {
	if (!media) return null;
	const sizes = [
		...Object.values(media.formats ?? {}),
		...(media.width && media.height ? [{ url: media.url, width: media.width }] : [])
	]
		.filter((size, i, all) => all.findIndex((s) => s.width === size.width) === i)
		.sort((a, b) => a.width - b.width);
	return {
		src: mediaUrl(media.url),
		srcset:
			sizes.length > 1 ? sizes.map((s) => `${mediaUrl(s.url)} ${s.width}w`).join(', ') : undefined,
		alt: media.alternativeText ?? '',
		width: media.width,
		height: media.height
	};
}

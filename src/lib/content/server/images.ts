// Linked photos from Unsplash and Pexels (#40): responsive sizes through their URL parameters,
// and credit links in the form the platforms ask for. Used on the server and in tests.

export type PhotoSource = 'unsplash' | 'pexels' | 'other';

const WIDTHS = [640, 960, 1280, 1920];

/** Which CDN serves this URL, if it's one whose URL parameters can resize images. */
export function imageHost(url: string): 'unsplash' | 'pexels' | undefined {
	try {
		const host = new URL(url).hostname;
		if (host === 'images.unsplash.com') return 'unsplash';
		if (host === 'images.pexels.com') return 'pexels';
	} catch {
		// Relative or malformed: not an external photo.
	}
	return undefined;
}

function sized(url: string, width: number): string {
	const u = new URL(url);
	if (imageHost(url) === 'unsplash') {
		u.searchParams.set('w', String(width));
		u.searchParams.set('q', '80');
		u.searchParams.set('auto', 'format');
		u.searchParams.set('fit', 'max');
	} else {
		u.searchParams.set('auto', 'compress');
		u.searchParams.set('cs', 'tinysrgb');
		u.searchParams.set('w', String(width));
	}
	return u.href;
}

/** `src` and `srcset` for an image URL; non-CDN URLs are used as they are. */
export function responsive(url: string): { src: string; srcset?: string } {
	if (!imageHost(url)) return { src: url };
	return {
		src: sized(url, 1280),
		srcset: WIDTHS.map((w) => `${sized(url, w)} ${w}w`).join(', ')
	};
}

/** Unsplash asks for referral parameters on links back to the photographer and to Unsplash. */
export function creditHref(url: string, source: PhotoSource | null): string {
	if (source !== 'unsplash') return url;
	try {
		const u = new URL(url);
		u.searchParams.set('utm_source', 'bhargavshukla.com');
		u.searchParams.set('utm_medium', 'referral');
		return u.href;
	} catch {
		return url;
	}
}

export const SOURCE_NAMES: Record<PhotoSource, string> = {
	unsplash: 'Unsplash',
	pexels: 'Pexels',
	other: ''
};

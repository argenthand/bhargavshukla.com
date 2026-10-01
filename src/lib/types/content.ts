// Strapi 5 REST shapes the frontend reads (docs/content-model.md). Responses are flat: no `attributes`.

export interface Media {
	url: string;
	alternativeText: string | null;
	width: number | null;
	height: number | null;
	/** Resized copies Strapi makes on upload (thumbnail, small, medium, large), when the original is bigger. */
	formats?: Record<string, MediaFormat> | null;
}

export interface MediaFormat {
	url: string;
	width: number;
	height: number;
}

export interface Link {
	label: string;
	url: string;
}

/** shared.image (#40): an upload (`file`) or a linked, credited photo (`url`). */
export interface ImageField {
	file: Media | null;
	url: string | null;
	alt: string;
	creditName: string | null;
	creditUrl: string | null;
	source: 'unsplash' | 'pexels' | 'other' | null;
	sourceUrl: string | null;
}

/** An image ready to render: sizes resolved, credit links built. */
export interface ResolvedImage {
	src: string;
	srcset?: string;
	alt: string;
	width: number | null;
	height: number | null;
	credit?: { name: string; href: string | null; source: string; sourceHref: string | null };
}

export interface Seo {
	metaTitle: string | null;
	metaDescription: string | null;
	ogImage: Media | null;
	canonicalUrl: string | null;
}

export interface Category {
	documentId: string;
	name: string;
	slug: string;
}

/** A post as lists show it: no body. */
export interface PostSummary {
	documentId: string;
	title: string;
	slug: string;
	summary: string;
	featured: boolean;
	displayDate: string | null;
	publishedAt: string;
	updatedAt: string;
	// Strapi can't make relations required, so a post may have no category.
	category: Category | null;
}

export interface Post extends PostSummary {
	body: string;
	cover: ImageField | null;
	related: PostSummary[];
	seo: Seo | null;
}

/** The home intro and contact links (single type). */
export interface Profile {
	name: string;
	tagline: string;
	/** Optional headshot (#59); the intro lays out the same without it. */
	photo: Media | null;
	bio: string;
	email: string | null;
	linkedin: string | null;
	github: string | null;
}

/** The /resume page (single type); the header comes from the Profile. */
export interface Resume {
	location: string | null;
	summary: string;
	updatedAt: string;
	experience: {
		role: string;
		company: string;
		location: string | null;
		startDate: string;
		endDate: string | null;
		highlights: string | null;
	}[];
	skillGroups: { label: string; skills: string }[];
	education: { credential: string; school: string; year: string | null }[];
}

export interface Tag {
	name: string;
	slug: string;
}

export type AsideKind = 'code' | 'quote' | 'tip' | 'thought';

/** Short-form (#18), as Strapi returns it. */
export interface Aside {
	documentId: string;
	kind: AsideKind;
	title: string | null;
	slug: string;
	body: string;
	sourceAuthor: string | null;
	sourceTitle: string | null;
	sourceUrl: string | null;
	publishedAt: string;
	tags: Tag[];
}

/** An aside ready to render: body as HTML, plus a plain-text label for links and titles. */
export interface RenderedAside extends Omit<Aside, 'body'> {
	html: string;
	label: string;
}

export interface Page<T> {
	data: T[];
	meta: { pagination: { page: number; pageSize: number; pageCount: number; total: number } };
}

/** An h2/h3 in a rendered post body, for the table of contents. */
export interface Heading {
	id: string;
	text: string;
	level: 2 | 3;
}

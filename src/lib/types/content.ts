// Strapi 5 REST shapes the frontend reads (docs/content-model.md). Responses are flat: no `attributes`.

export interface Media {
	url: string;
	alternativeText: string | null;
	width: number | null;
	height: number | null;
}

export interface Link {
	label: string;
	url: string;
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
	cover: Media | null;
	related: PostSummary[];
	seo: Seo | null;
}

/** The home intro and contact links (single type). */
export interface Profile {
	name: string;
	tagline: string;
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

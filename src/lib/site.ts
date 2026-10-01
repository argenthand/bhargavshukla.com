// Site structure that isn't content. The intro copy and contact links live in the Strapi profile (#42).

export const site = {
	/** Header, footer and page titles; also the intro's fallback when the profile can't be loaded. */
	name: 'Bhargav Shukla',
	/** Production origin for canonical and Open Graph URLs. */
	url: 'https://bhargavshukla.com',
	/** The Writing page's standfirst; also the home description when the profile can't load. */
	description: 'Notes on leading engineers, and still being one.'
};

/**
 * Primary nav: the header on md+ and the bottom tab bar below it.
 * `live` stays false until the section works in production (#18 Asides, #5 Resume), so visitors
 * never hit a 404 or an error page.
 */
const sections = [
	{ href: '/blog', label: 'Writing', icon: 'pen', live: true },
	{ href: '/asides', label: 'Asides', icon: 'note', live: false },
	{ href: '/resume', label: 'Resume', icon: 'file', live: false }
] as const;

export const nav = sections.filter((section) => section.live);

export const isLive = (href: string) => nav.some((section) => section.href === href);

// Site structure that isn't content. The intro copy and contact links live in the Strapi profile (#42).

export const site = {
	/** Header, footer and page titles; also the intro's fallback when the profile can't be loaded. */
	name: 'Bhargav Shukla'
};

/**
 * Primary nav: the header on md+ and the bottom tab bar below it.
 * `live` stays false until the section works in production (#18, #5), so visitors
 * never hit a 404 or an error page.
 */
const sections = [
	{ href: '/blog', label: 'Writing', icon: 'pen', live: true },
	{ href: '/snippets', label: 'Snippets', icon: 'code', live: false },
	{ href: '/resume', label: 'Resume', icon: 'file', live: false }
] as const;

export const nav = sections.filter((section) => section.live);

export const isLive = (href: string) => nav.some((section) => section.href === href);

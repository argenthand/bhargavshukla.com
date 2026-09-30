// Site-wide copy and links: the header, the home intro and (later) the resume and SEO tags.

export const site = {
	name: 'Bhargav Shukla',
	tagline: 'Engineering Manager',
	email: 'hello@bhargavshukla.com',
	linkedin: 'https://linkedin.com/in/bhargav-shukla',
	github: 'https://github.com/argenthand'
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

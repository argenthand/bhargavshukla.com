// Site-wide copy and links: the header, the home intro and (later) the resume and SEO tags.

export const site = {
	name: 'Bhargav Shukla',
	tagline: 'Engineering Manager',
	email: 'hello@bhargavshukla.com',
	linkedin: 'https://linkedin.com/in/bhargav-shukla',
	github: 'https://github.com/argenthand'
};

/** Primary nav: the header on md+ and the bottom tab bar below it. */
export const nav = [
	{ href: '/blog', label: 'Writing', icon: 'pen' },
	{ href: '/snippets', label: 'Snippets', icon: 'code' },
	{ href: '/resume', label: 'Resume', icon: 'file' }
] as const;

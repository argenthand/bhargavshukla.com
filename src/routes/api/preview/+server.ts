// Strapi's "Open preview" target (#57): a short-lived link signed by the CMS (cms/config/admin.ts)
// turns preview on with a signed cookie, then opens the page. See $lib/server/preview.ts.

import { env } from '$env/dynamic/private';
import { error, redirect } from '@sveltejs/kit';
import { COOKIE_TTL_S, PREVIEW_COOKIE, previewCookie, verifyLink } from '$lib/server/preview';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, cookies }) => {
	const link = {
		path: url.searchParams.get('path'),
		exp: url.searchParams.get('exp'),
		sig: url.searchParams.get('sig')
	};
	if (!(await verifyLink(link, env.PREVIEW_SECRET))) error(401, 'Invalid or expired preview link');

	cookies.set(PREVIEW_COOKIE, await previewCookie(env.PREVIEW_SECRET!), {
		path: '/',
		httpOnly: true,
		secure: url.protocol === 'https:',
		// The admin shows the preview in an iframe on cms.bhargavshukla.com: same site, so Lax works.
		sameSite: 'lax',
		maxAge: COOKIE_TTL_S
	});
	redirect(303, link.path!);
};

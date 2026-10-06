// "Exit" in the preview banner (#57): drops the cookie and goes back to the page, now published-only.

import { redirect } from '@sveltejs/kit';
import { isSitePath, PREVIEW_COOKIE } from '$lib/publishing/index.server';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ url, cookies }) => {
	cookies.delete(PREVIEW_COOKIE, { path: '/' });
	const back = url.searchParams.get('path') ?? '/';
	redirect(303, isSitePath(back) ? back : '/');
};

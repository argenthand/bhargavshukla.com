// The printed resume's email (#135, docs/contact.md). Pages never carry the address: the resume
// fetches it from here after it loads and shows it in print only. It's encoded (reversed, then
// base64) so scrapers that look for addresses in responses don't find one; `decodeContact` undoes it.

import { json } from '@sveltejs/kit';
import { encodeContact } from '$lib/contact';
import { getContactEmail } from '$lib/content/index.server';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	try {
		const email = await getContactEmail(locals);
		return json(
			{ e: email ? encodeContact(email) : null },
			{ headers: { 'cache-control': 'public, max-age=300', 'x-robots-tag': 'noindex' } }
		);
	} catch (err) {
		console.error('Print contact unavailable', err);
		return json({ e: null }, { headers: { 'cache-control': 'no-store' } });
	}
};

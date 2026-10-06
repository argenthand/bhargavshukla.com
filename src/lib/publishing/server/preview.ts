// Draft preview (#57, docs/caching.md → Draft preview). Strapi's "Open preview" button opens a
// short-lived signed link (cms/config/admin.ts); /api/preview checks it and sets a signed cookie;
// with a valid cookie, page loads also read drafts. Anyone can set a cookie by hand, so only a
// cookie this server signed, and not yet expired, turns preview on.
//
// Signatures are HMAC-SHA256 with PREVIEW_SECRET, hex. The CMS signs links with the same format:
// keep `linkPayload` in step with `previewLink` in cms/config/admin.ts.

export { PREVIEW_COOKIE } from './edge-cache';

/** How long a preview session lasts. */
export const COOKIE_TTL_S = 2 * 60 * 60;
/** Links are minted for 5 minutes; anything valid for longer than this was not minted by us. */
export const LINK_MAX_TTL_S = 10 * 60;

const encoder = new TextEncoder();

const linkPayload = (path: string, exp: number) => `link\n${path}\n${exp}`;
const cookiePayload = (exp: number) => `cookie\n${exp}`;

function key(secret: string, usage: KeyUsage) {
	return crypto.subtle.importKey(
		'raw',
		encoder.encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		[usage]
	);
}

const toHex = (buffer: ArrayBuffer) =>
	[...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');

function fromHex(hex: string): Uint8Array<ArrayBuffer> | undefined {
	if (!/^(?:[0-9a-f]{2})+$/.test(hex)) return undefined;
	const bytes = new Uint8Array(hex.length / 2);
	for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
	return bytes;
}

export async function sign(payload: string, secret: string): Promise<string> {
	return toHex(
		await crypto.subtle.sign('HMAC', await key(secret, 'sign'), encoder.encode(payload))
	);
}

/** `crypto.subtle.verify` compares in constant time. */
async function verify(payload: string, signature: string, secret: string): Promise<boolean> {
	const bytes = fromHex(signature);
	if (!bytes || !secret) return false;
	return crypto.subtle.verify('HMAC', await key(secret, 'verify'), bytes, encoder.encode(payload));
}

/** A site path to send the browser to: one leading slash, so never another host (`//evil`). */
export const isSitePath = (path: string) => /^\/(?![/\\])/.test(path);

/** Checks a link from the CMS: signed by us, for a site path, not expired, minted recently. */
export async function verifyLink(
	link: { path: string | null; exp: string | null; sig: string | null },
	secret: string | undefined,
	now = Math.floor(Date.now() / 1000)
): Promise<boolean> {
	const { path, exp, sig } = link;
	const expires = Number(exp);
	if (!secret || !path || !sig || !Number.isInteger(expires)) return false;
	if (!isSitePath(path) || expires <= now || expires > now + LINK_MAX_TTL_S) return false;
	return verify(linkPayload(path, expires), sig, secret);
}

/** The cookie value: `<exp>.<sig>`. */
export async function previewCookie(secret: string, now = Math.floor(Date.now() / 1000)) {
	const exp = now + COOKIE_TTL_S;
	return `${exp}.${await sign(cookiePayload(exp), secret)}`;
}

export async function verifyCookie(
	value: string | undefined,
	secret: string | undefined,
	now = Math.floor(Date.now() / 1000)
): Promise<boolean> {
	if (!value || !secret) return false;
	const [exp, sig] = value.split('.');
	const expires = Number(exp);
	if (!sig || !Number.isInteger(expires) || expires <= now || expires > now + COOKIE_TTL_S)
		return false;
	return verify(cookiePayload(expires), sig, secret);
}

/** For tests and local tooling: the link the CMS would mint. */
export async function signLink(path: string, secret: string, exp: number) {
	return { path, exp: String(exp), sig: await sign(linkPayload(path, exp), secret) };
}

/**
 * In preview, a list shows every document's draft (its latest edits). Drafts carry no publish date,
 * so the published list says which ones are live: those keep their publish date; the rest are
 * marked `draft` and sort by their last edit.
 */
export function mergeDrafts<
	T extends { documentId: string; publishedAt: string | null; updatedAt?: string }
>(
	published: { documentId: string; publishedAt: string | null }[],
	drafts: T[]
): (T & { publishedAt: string; draft: boolean })[] {
	const live = new Map(published.map((doc) => [doc.documentId, doc.publishedAt]));
	return drafts.map((doc) => {
		const publishedAt = live.get(doc.documentId);
		return publishedAt
			? { ...doc, publishedAt, draft: false }
			: { ...doc, publishedAt: doc.updatedAt ?? new Date(0).toISOString(), draft: true };
	});
}

import { createHmac } from 'node:crypto';
import type { Core, UID } from '@strapi/strapi';

/** How long a preview link works once the admin mints it. The site refuses anything over 10 min. */
const LINK_TTL_S = 5 * 60;

/** Where each previewable type lives on the site; other types get no Preview button. */
const SITE_PATHS: Record<string, (slug: string) => string> = {
  'api::post.post': (slug) => `/blog/${slug}`,
  'api::aside.aside': (slug) => `/asides/${slug}`,
};

/**
 * Draft preview (#57): a short-lived link to the site's /api/preview, signed with PREVIEW_SECRET.
 * Keep the signed text in step with `linkPayload` in src/lib/server/preview.ts.
 */
function previewLink(clientUrl: string, secret: string, path: string) {
  const exp = Math.floor(Date.now() / 1000) + LINK_TTL_S;
  const sig = createHmac('sha256', secret).update(`link\n${path}\n${exp}`).digest('hex');
  return `${clientUrl}/api/preview?${new URLSearchParams({ path, exp: String(exp), sig })}`;
}

async function sitePath(uid: string, documentId: string): Promise<string | null> {
  if (uid === 'api::resume.resume') return '/resume';
  const toPath = SITE_PATHS[uid];
  if (!toPath) return null;
  const doc = await strapi
    .documents(uid as UID.ContentType)
    .findOne({ documentId, status: 'draft', fields: ['slug'] as never });
  const slug = (doc as { slug?: string } | null)?.slug;
  return slug ? toPath(slug) : null;
}

const config = ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Admin => ({
  auth: {
    secret: env('ADMIN_JWT_SECRET')!,
  },
  apiToken: {
    salt: env('API_TOKEN_SALT')!,
  },
  transfer: {
    token: {
      salt: env('TRANSFER_TOKEN_SALT')!,
    },
  },
  secrets: {
    encryptionKey: env('ENCRYPTION_KEY')!,
  },
  // Draft preview (#57): needs CLIENT_URL (the site) and PREVIEW_SECRET (shared with the site).
  preview: {
    enabled: Boolean(env('CLIENT_URL') && env('PREVIEW_SECRET')),
    config: {
      allowedOrigins: [env('CLIENT_URL', '')],
      async handler(uid, { documentId, status }) {
        const clientUrl = env('CLIENT_URL', '').replace(/\/+$/, '');
        const path = await sitePath(uid, documentId);
        if (!path) return null;
        // The published tab opens the live page; the draft tab turns preview on first.
        return status === 'published'
          ? `${clientUrl}${path}`
          : previewLink(clientUrl, env('PREVIEW_SECRET', ''), path);
      },
    },
  },
  flags: {
    nps: env.bool('FLAG_NPS', true),
    promoteEE: env.bool('FLAG_PROMOTE_EE', true),
    docLinks: env.bool('FLAG_DOC_LINKS', true),
  },
});

export default config;

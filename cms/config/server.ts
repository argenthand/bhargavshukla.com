import type { Core } from '@strapi/strapi';

const config = ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Server => ({
  host: env('HOST', '0.0.0.0'),
  port: env.int('PORT', 1337),
  // Production sits behind the Cloudflare Tunnel (docs/infrastructure.md): its public URL,
  // and trusting X-Forwarded-* so Koa sees HTTPS and sets the admin's secure cookies.
  url: env('PUBLIC_URL', ''),
  proxy: { koa: env.bool('IS_PROXIED', false) },
  app: {
    keys: env.array('APP_KEYS')!,
  },
  webhooks: {
    populateRelations: env.bool('WEBHOOKS_POPULATE_RELATIONS', false),
  },
});

export default config;

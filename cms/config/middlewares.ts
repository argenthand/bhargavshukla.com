import type { Core } from '@strapi/strapi';

// The admin previews uploads from R2 (#13), so the CSP allows the media host.
const mediaSources = ["'self'", 'data:', 'blob:', 'market-assets.strapi.io', 'media.bhargavshukla.com'];

const config: Core.Config.Middlewares = [
  'strapi::logger',
  'strapi::errors',
  {
    name: 'strapi::security',
    config: {
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'connect-src': ["'self'", 'https:'],
          'img-src': mediaSources,
          'media-src': mediaSources,
          upgradeInsecureRequests: null,
        },
      },
    },
  },
  'strapi::cors',
  'strapi::poweredBy',
  'strapi::query',
  'strapi::body',
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
];

export default config;

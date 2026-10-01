import type { Core } from '@strapi/strapi';

// The admin previews uploads from R2 (#13), so the CSP allows the media host.
const mediaSources = ["'self'", 'data:', 'blob:', 'market-assets.strapi.io', 'media.bhargavshukla.com'];

// Draft preview (#57): the admin shows the site in an iframe.
const frameSources = ["'self'", process.env.CLIENT_URL].filter((s): s is string => Boolean(s));

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
          'frame-src': frameSources,
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

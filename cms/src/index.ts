import type { Core } from '@strapi/strapi';
import { assertImage, type ImageData } from './lib/validate-image';

export default {
  register({ strapi }: { strapi: Core.Strapi }) {
    // Post cover (#40): either an upload or a credited link. Runs for the admin and the API alike.
    strapi.documents.use(async (context, next) => {
      if (
        context.uid === 'api::post.post' &&
        (context.action === 'create' || context.action === 'update')
      ) {
        const data = (context.params as { data?: { cover?: ImageData | null } }).data;
        if (data && 'cover' in data) assertImage('Cover', data.cover);
      }
      return next();
    });
  },

  bootstrap() {},
};

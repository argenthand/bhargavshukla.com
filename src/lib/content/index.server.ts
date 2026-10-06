// The content domain's server interface. Import from here, not from the files behind it.
export { getAside, listAsides } from './server/asides';
export { renderMarkdown } from './server/markdown';
export { getPost, homePosts, listPosts, pickNextUp, postPage } from './server/posts';
export { getResume } from './server/resume';
export { getContactEmail, getPrivacy, getProfile } from './server/single-types';
export type { Employer, Role } from './server/resume';
export { strapi } from './server/strapi';

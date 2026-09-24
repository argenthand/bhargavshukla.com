import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';

// Content is validated by the content module (src/content/index.ts), not here,
// so the same rules run in unit tests and in the build.
const base = process.env.CONTENT_PATH ?? './test-content';

const categories = defineCollection({ loader: glob({ pattern: '*.json', base: `${base}/categories` }) });
const posts = defineCollection({ loader: glob({ pattern: '*.md', base: `${base}/posts` }) });

export const collections = { categories, posts };

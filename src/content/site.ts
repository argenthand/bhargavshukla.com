import { getCollection, render } from 'astro:content';
import { loadContent } from './index';

/** Load, validate and order all content for the build. */
export async function getSiteContent() {
  const [categories, posts, snippets, resume, settings] = await Promise.all([
    getCollection('categories'),
    getCollection('posts'),
    getCollection('snippets'),
    getCollection('resume'),
    getCollection('settings'),
  ]);
  const content = loadContent(
    { categories, posts, snippets, resume, settings },
    { now: new Date(), includeDrafts: import.meta.env.DEV },
  );
  const entries = new Map(posts.map((entry) => [entry.id, entry]));
  return {
    ...content,
    renderBody: (id: string) => render(entries.get(id)!),
  };
}

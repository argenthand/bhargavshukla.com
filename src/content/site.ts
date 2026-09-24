import { getCollection, render } from 'astro:content';
import { loadContent } from './index';

/** Load, validate and order all content for the build. */
export async function getSiteContent() {
  const [categories, posts, settings] = await Promise.all([
    getCollection('categories'),
    getCollection('posts'),
    getCollection('settings'),
  ]);
  const content = loadContent(
    { categories, posts, settings },
    { now: new Date(), includeDrafts: import.meta.env.DEV },
  );
  const entries = new Map(posts.map((entry) => [entry.id, entry]));
  return {
    ...content,
    renderBody: (id: string) => render(entries.get(id)!),
  };
}

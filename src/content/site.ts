import { getCollection, render } from 'astro:content';
import { loadContent } from './index';

/** Load, validate and order all content for the build. */
export async function getSiteContent() {
  const [categories, posts] = await Promise.all([getCollection('categories'), getCollection('posts')]);
  const content = loadContent({ categories, posts });
  const entries = new Map(posts.map((entry) => [entry.id, entry]));
  return {
    ...content,
    // Stopgap: Drafts must never be published. Full Draft/Scheduled visibility belongs in the content module (later ticket).
    posts: content.posts.filter((post) => !post.draft),
    renderBody: (id: string) => render(entries.get(id)!),
  };
}

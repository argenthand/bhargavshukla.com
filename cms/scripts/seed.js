'use strict';

// Local development seed (#8): categories, a few sample posts with code blocks, and a
// read-only API token for the SvelteKit frontend. Safe to re-run; existing data is kept.
// Usage: npm run seed

const { compileStrapi, createStrapi } = require('@strapi/strapi');

const CATEGORIES = ['Leadership', 'Engineering', 'Tools', 'Ideas', 'Books'];

const TOKEN_NAME = 'frontend-read (local)';
const TOKEN_PERMISSIONS = [
  'api::post.post.find',
  'api::post.post.findOne',
  'api::category.category.find',
  'api::category.category.findOne',
];

const POSTS = [
  {
    title: 'Sample: Code review as a leadership tool',
    slug: 'sample-code-review-as-a-leadership-tool',
    category: 'leadership',
    featured: true,
    summary:
      'Sample post. Reviews are where standards get set, whether you mean them to or not. A few habits that make them teach instead of gatekeep.',
    body: [
      'Reviews are where a team learns what "good" means here.',
      '',
      '## Ask, then suggest',
      '',
      'A question leaves room for context you do not have:',
      '',
      '```ts',
      'type Comment = { kind: "question" | "suggestion" | "blocker"; body: string };',
      '',
      'const nit: Comment = { kind: "suggestion", body: "Could this be a Map?" };',
      '```',
      '',
      'Label **blockers** explicitly so everything else reads as optional.',
    ].join('\n'),
  },
  {
    title: 'Sample: Typed fetch helpers in SvelteKit',
    slug: 'sample-typed-fetch-helpers-in-sveltekit',
    category: 'engineering',
    featured: true,
    displayDate: '2026-08-15',
    summary: 'Sample post. A small wrapper that keeps Strapi responses typed end to end.',
    body: [
      'A thin wrapper beats a client library at this size.',
      '',
      '```ts',
      'export async function strapi<T>(fetch: typeof globalThis.fetch, path: string): Promise<T> {',
      '\tconst res = await fetch(`${CMS_URL}/api/${path}`, {',
      '\t\theaders: { Authorization: `Bearer ${CMS_TOKEN}` }',
      '\t});',
      '\tif (!res.ok) throw new Error(`Strapi ${res.status}: ${path}`);',
      '\treturn (await res.json()) as T;',
      '}',
      '```',
      '',
      'And a shell one-liner to poke it:',
      '',
      '```bash',
      'curl -s -H "Authorization: Bearer $TOKEN" "localhost:1337/api/posts?populate=category" | jq ".data[].title"',
      '```',
    ].join('\n'),
  },
  {
    title: 'Sample: Notes on An Elegant Puzzle',
    slug: 'sample-notes-on-an-elegant-puzzle',
    category: 'books',
    summary: 'Sample post. Will Larson, An Elegant Puzzle: size teams deliberately and treat migrations as the default way to pay down debt.',
    body: [
      'A book review is a post in the Books category.',
      '',
      '> Migrations are the sole scalable fix to tech debt.',
      '',
      '```python',
      'def team_size_ok(engineers: int) -> bool:',
      '    return 6 <= engineers <= 8',
      '```',
    ].join('\n'),
  },
];

async function seed(strapi) {
  const categories = strapi.documents('api::category.category');
  const bySlug = {};
  for (const name of CATEGORIES) {
    const slug = name.toLowerCase();
    const existing = await categories.findFirst({ filters: { slug } });
    bySlug[slug] = existing ?? (await categories.create({ data: { name, slug } }));
  }
  console.log(`Categories: ${CATEGORIES.join(', ')}`);

  const posts = strapi.documents('api::post.post');
  const created = [];
  for (const { category, ...post } of POSTS) {
    const existing = await posts.findFirst({ filters: { slug: post.slug } });
    if (existing) continue;
    created.push(
      await posts.create({
        data: { ...post, category: bySlug[category].documentId },
        status: 'published',
      })
    );
  }
  // The first sample post points at the other two as "Next up".
  if (created.length === POSTS.length) {
    await posts.update({
      documentId: created[0].documentId,
      data: { related: created.slice(1).map((p) => p.documentId) },
      status: 'published',
    });
  }
  console.log(`Posts: ${created.length} created, ${POSTS.length - created.length} already there`);

  const tokens = strapi.service('admin::api-token');
  if (await tokens.exists({ name: TOKEN_NAME })) {
    console.log(`API token "${TOKEN_NAME}" already exists (view or regenerate it in Settings → API Tokens)`);
  } else {
    const token = await tokens.create({
      name: TOKEN_NAME,
      description: 'Read-only token for the SvelteKit frontend (local development)',
      type: 'custom',
      lifespan: null,
      permissions: TOKEN_PERMISSIONS,
    });
    console.log(`API token "${TOKEN_NAME}": ${token.accessKey}`);
  }
}

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('The seed is for local development only.');
  }
  const app = await createStrapi(await compileStrapi()).load();
  app.log.level = 'error';
  try {
    await seed(app);
  } finally {
    await app.destroy();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

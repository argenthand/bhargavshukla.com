'use strict';

// Local development seed (#8): categories, a few sample posts with code blocks, the profile (#42),
// a sample resume (#5), sample asides and tags (#18), the privacy note (#154)
// and a read-only API token for the SvelteKit frontend. Safe to re-run; existing data is kept, and an
// existing token gets any new permissions.
// Usage: npm run seed

const { compileStrapi, createStrapi } = require('@strapi/strapi');

const CATEGORIES = ['Leadership', 'Engineering', 'Tools', 'Ideas', 'Books'];

const TOKEN_NAME = 'frontend-read (local)';
const TOKEN_PERMISSIONS = [
  'api::post.post.find',
  'api::post.post.findOne',
  'api::category.category.find',
  'api::category.category.findOne',
  'api::profile.profile.find',
  'api::resume.resume.find',
  'api::privacy.privacy.find',
  'api::aside.aside.find',
  'api::aside.aside.findOne',
  'api::tag.tag.find',
  'api::tag.tag.findOne',
];

// The privacy note's first draft (#154, PRIV-* on the design canvas); the real copy is edited in production.
const PRIVACY = {
  lead: 'No cookies, nothing stored on your device, and nothing kept that could identify you.',
  body: [
    '## Page views',
    'This site counts the pages you view, and on the first page of a visit, the site that sent you here (its name, like www.google.com, nothing more).',
    '## Things you do here',
    'A few things you do are counted too: finding an easter egg, choosing a palette, printing the resume, starting or sending a message, following a link to another site (its address, not the page), and how long you spend reading a post.',
    "Each count, page views included, is only the thing, the page it happened on and when. Nothing about you is kept, not even your IP address, so it can't be linked to you or to anything else you did here. The counts stay with this site, on Cloudflare, for three months. Visitors in the European Economic Area, the UK and Switzerland aren't counted.",
    '## Read counts',
    'The count on a post ("1.2K reads") is kept by this site, on Cloudflare. To count each reader once a day, it keeps a hash of your IP address and browser with a secret that changes every day; both are deleted the next day. Only the number stays.',
    '## Questions',
    'Send me a message with the card below.',
  ].join('\n\n'),
};

// Placeholder roles from the design mockups, clearly marked; the real resume is written in production.
const RESUME = {
  location: 'Guelph, ON, Canada',
  summary:
    'Sample summary. Engineering manager with years of experience building web, mobile and embedded software. Recently moved from tech lead to leading a team.',
  experience: [
    {
      role: 'Engineering Manager',
      company: 'Sample Co.',
      location: 'Kitchener, ON · Hybrid',
      startDate: '2026-03-01',
      endDate: null,
      highlights: '- Lead a team of engineers shipping the customer web and mobile apps.\n- Introduced a team charter, weekly 1:1s and a quarterly growth-plan cycle.',
    },
    {
      role: 'Senior Software Engineer, Tech Lead',
      company: 'Sample Co.',
      location: 'Kitchener, ON · Hybrid',
      startDate: '2023-01-01',
      endDate: '2026-03-01',
      highlights: '- Tech lead for the policy-servicing app (.NET, React, PostgreSQL).\n- Wrote the team’s RFC template and ran fortnightly architecture reviews.',
    },
  ],
  skillGroups: [
    { label: 'Leadership', skills: '1:1s and coaching, hiring, roadmap planning, incident reviews' },
    { label: 'Languages', skills: 'C#, TypeScript, Python, SQL' },
  ],
  education: [{ credential: 'Sample degree', school: 'Sample University', year: '2018' }],
};

// The mockups' examples (F-asides-*), one per kind. Local test data.
const TAGS = ['books', 'tech-debt', 'leadership', 'one-on-ones', 'git'];
const ASIDES = [
  {
    kind: 'quote',
    slug: 'sample-larson-migrations',
    body: 'Migrations are the sole scalable fix to tech debt.',
    sourceAuthor: 'Will Larson',
    sourceTitle: 'An Elegant Puzzle',
    sourceUrl: 'https://lethain.com/elegant-puzzle/',
    tags: ['books', 'tech-debt'],
  },
  {
    kind: 'tip',
    title: 'Sample: Let the report own the 1:1 doc',
    slug: 'sample-let-the-report-own-the-1-1-doc',
    body: 'One shared doc per person, newest meeting at the top. They add topics first; I add mine after. If it’s still empty the day before, that’s worth a gentle question too.',
    tags: ['leadership', 'one-on-ones'],
  },
  {
    kind: 'code',
    title: 'Sample: Find the commit that deleted a file',
    slug: 'sample-find-the-commit-that-deleted-a-file',
    body: ['```bash', 'git log --diff-filter=D --oneline -- path/to/file', '# then restore it from the parent of that commit', 'git checkout <sha>^ -- path/to/file', '```'].join('\n'),
    tags: ['git'],
  },
  {
    kind: 'thought',
    slug: 'sample-surprised-in-public',
    body: 'The fastest way to lose a team’s trust: be surprised in public by something they told you in private.',
    tags: ['leadership'],
  },
];

const PROFILE = {
  name: 'Bhargav Shukla',
  tagline: 'Engineering Manager',
  bio: [
    "Hey there. I'm a full-stack dev turned Engineering Manager who spends most of my time working with .NET and TypeScript. Over the last few years, I've jumped across a bunch of different stacks, including everything from Django + Vue on AWS to React + React Native + .NET on Azure. Domain-wise, I've moved around a fair bit too, building software for logistics, healthcare, P&C insurance, and currently, fintech.",
    '',
    'After serving as Tech Lead for my team since 2024, I recently made the leap into the Engineering Manager role. Trading the deep focus of IC work for 1-on-1s, hiring, and team roadmap strategy has been great, but it is definitely a completely different ballgame.',
    '',
    "That transition is the main reason I started this blog. I wanted a place to write about going from IC to EM in real time, focusing on the daily friction, the soft skills you can't really prepare for, and how to stay useful technically without micromanaging the people around you.",
  ].join('\n'),
  email: 'hello@bhargavshukla.com',
  linkedin: 'https://linkedin.com/in/bhargav-shukla',
  github: 'https://github.com/argenthand',
};

const SAMPLE_COVER = {
  url: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085',
  alt: 'A laptop with code on screen on a desk',
  creditName: 'Sample credit',
  creditUrl: 'https://unsplash.com',
  source: 'unsplash',
  sourceUrl: 'https://unsplash.com',
};

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

  // A linked, credited cover (#40) on one sample post. Local test data: the credit is a placeholder.
  const withCover = await posts.findFirst({
    filters: { slug: 'sample-typed-fetch-helpers-in-sveltekit' },
    populate: ['cover'],
  });
  if (withCover && !withCover.cover) {
    await posts.update({
      documentId: withCover.documentId,
      data: { cover: SAMPLE_COVER },
      status: 'published',
    });
    console.log('Sample cover: added');
  }

  const tagDocs = strapi.documents('api::tag.tag');
  const tagIds = {};
  for (const name of TAGS) {
    const existing = await tagDocs.findFirst({ filters: { slug: name } });
    tagIds[name] = (existing ?? (await tagDocs.create({ data: { name, slug: name } }))).documentId;
  }
  const asides = strapi.documents('api::aside.aside');
  let newAsides = 0;
  for (const { tags, ...aside } of ASIDES) {
    if (await asides.findFirst({ filters: { slug: aside.slug } })) continue;
    await asides.create({ data: { ...aside, tags: tags.map((t) => tagIds[t]) }, status: 'published' });
    newAsides++;
  }
  console.log(`Asides: ${newAsides} created, ${ASIDES.length - newAsides} already there`);

  const profile = strapi.documents('api::profile.profile');
  if (await profile.findFirst()) {
    console.log('Profile: already there');
  } else {
    await profile.create({ data: PROFILE });
    console.log('Profile: created');
  }

  const privacy = strapi.documents('api::privacy.privacy');
  if (await privacy.findFirst()) {
    console.log('Privacy: already there');
  } else {
    await privacy.create({ data: PRIVACY });
    console.log('Privacy: created');
  }

  const resume = strapi.documents('api::resume.resume');
  if (await resume.findFirst({ status: 'draft' })) {
    console.log('Resume: already there');
  } else {
    await resume.create({ data: RESUME, status: 'published' });
    console.log('Resume: sample created and published');
  }

  const tokens = strapi.service('admin::api-token');
  if (await tokens.exists({ name: TOKEN_NAME })) {
    const existing = await tokens.getByName(TOKEN_NAME);
    await tokens.update(existing.id, { permissions: TOKEN_PERMISSIONS });
    console.log(`API token "${TOKEN_NAME}" already exists; permissions updated (view or regenerate it in Settings → API Tokens)`);
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

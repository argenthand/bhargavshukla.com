import { describe, expect, it } from 'vitest';
import { loadContent as loadContentAt, resumeSchema, type RawEntry } from './index';

const now = new Date('2026-09-15T16:00:00Z');
const load = (resume?: RawEntry) => loadContentAt({ categories: [], posts: [], resume: resume ? [resume] : [] }, { now });

const validData = () => ({
  name: 'Sample Person',
  headline: 'Engineering Manager',
  location: 'Sample City, ON',
  email: 'sample@example.com',
  linkedin: 'https://www.linkedin.com/in/sample',
  github: 'https://github.com/sample',
  summary: 'A short summary.',
  experience: [
    { role: 'Engineering Manager', company: 'Sample Co', dates: '2026 — Present', detail: 'Led a team.' },
    { role: 'Tech Lead', company: 'Other Co', dates: '2022 — 2026', detail: 'Shipped things.' },
  ],
  skills: [
    { group: 'Leadership', items: ['Hiring', '1:1s'] },
    { group: 'Web', items: ['TypeScript'] },
  ],
  education: [{ year: '2018', degree: 'B.Sc. Sample', school: 'Sample University' }],
});

const resume = (patch: Record<string, unknown> = {}): RawEntry => ({ id: 'resume', data: { ...validData(), ...patch } });
const without = (field: string): RawEntry => {
  const entry = resume();
  delete (entry.data as Record<string, unknown>)[field];
  return entry;
};

describe('Resume', () => {
  it('is null when there is no Resume content', () => {
    expect(load().resume).toBeNull();
  });

  it('loads the header, summary, Experience, grouped Skills and Education', () => {
    const { resume: loaded } = load(resume());
    expect(loaded).toMatchObject({
      name: 'Sample Person',
      headline: 'Engineering Manager',
      location: 'Sample City, ON',
      email: 'sample@example.com',
      linkedin: 'https://www.linkedin.com/in/sample',
      github: 'https://github.com/sample',
      summary: 'A short summary.',
    });
    expect(loaded?.experience).toHaveLength(2);
    expect(loaded?.skills[0]).toEqual({ group: 'Leadership', items: ['Hiring', '1:1s'] });
    expect(loaded?.education[0]).toEqual({ year: '2018', degree: 'B.Sc. Sample', school: 'Sample University' });
  });

  it('applies defaults: no LinkedIn or GitHub, no Education, and a built-in print easter egg', () => {
    const entry = resume({ linkedin: undefined, github: undefined, education: undefined });
    const { resume: loaded } = load(entry);
    expect(loaded?.linkedin).toBeNull();
    expect(loaded?.github).toBeNull();
    expect(loaded?.education).toEqual([]);
    expect(loaded?.printEasterEgg).not.toBe('');
  });

  it('lets the author change the print easter egg', () => {
    expect(load(resume({ printEasterEgg: 'Hello from paper.' })).resume?.printEasterEgg).toBe('Hello from paper.');
  });

  it.each(['name', 'headline', 'location', 'email', 'summary', 'experience', 'skills'])(
    'fails the build naming the Resume when %s is missing',
    (field) => {
      expect(() => load(without(field))).toThrow(new RegExp(`Resume "resume".*${field}`, 's'));
    },
  );

  it('needs at least one job and one Skills group with items', () => {
    expect(() => load(resume({ experience: [] }))).toThrow(/Resume "resume".*experience/s);
    expect(() => load(resume({ skills: [] }))).toThrow(/Resume "resume".*skills/s);
    expect(() => load(resume({ skills: [{ group: 'Web', items: [] }] }))).toThrow(/Resume "resume".*skills/s);
  });

  it('names the field inside a job when it is incomplete', () => {
    const experience = [{ role: 'Engineering Manager', company: 'Sample Co', dates: '2026 — Present' }];
    expect(() => load(resume({ experience }))).toThrow(/Resume "resume".*experience\.0\.detail/s);
  });

  it('rejects a malformed email or link, and unknown fields', () => {
    expect(() => load(resume({ email: 'not-an-email' }))).toThrow(/Resume "resume".*email/s);
    expect(() => load(resume({ github: 'github.com/sample' }))).toThrow(/Resume "resume".*github/s);
    expect(() => load(resume({ photo: 'me.jpg' }))).toThrow(/Resume "resume".*photo/s);
  });

  it('must be the file named "resume"', () => {
    expect(() => load({ id: 'cv', data: validData() })).toThrow(/Resume "cv".*"resume"/s);
  });

  it('follows the schema rule: every field is required, or optional with a default', () => {
    for (const [field, rule] of Object.entries(resumeSchema.shape)) {
      const whenAbsent = rule.safeParse(undefined);
      expect(!whenAbsent.success || whenAbsent.data !== undefined, `${field} is optional without a default`).toBe(true);
    }
  });
});

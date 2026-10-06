import { readFileSync } from 'node:fs';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { beforeEach, describe, expect, it } from 'vitest';
import {
	MAX_PATHS,
	readCounts,
	recordRead,
	visitorHash,
	type ReadsDb,
	type Statement
} from '../../server/reads';

/** D1's API over node:sqlite, with the real migration. */
function testDb(): ReadsDb & { sqlite: DatabaseSync } {
	const sqlite = new DatabaseSync(':memory:');
	sqlite.exec(readFileSync('migrations/0001_reads.sql', 'utf8'));
	const statement = (sql: string, values: SQLInputValue[] = []): Statement => ({
		bind: (...next) => statement(sql, next as SQLInputValue[]),
		run: async () => ({ meta: { changes: Number(sqlite.prepare(sql).run(...values).changes) } }),
		first: async <T>() => (sqlite.prepare(sql).get(...values) as T | undefined) ?? null,
		all: async <T>() => ({ results: sqlite.prepare(sql).all(...values) as T[] })
	});
	return {
		sqlite,
		prepare: (sql) => statement(sql),
		batch: async (statements) => Promise.all(statements.map((s) => s.run()))
	};
}

const visitor = { ip: '203.0.113.7', userAgent: 'Firefox' };
const read = (path: string, who = visitor) => ({ path, ...who });
const always = async () => true;
const DAY_1 = new Date('2026-10-01T09:00:00Z');
const DAY_1_LATE = new Date('2026-10-01T23:59:00Z');
const DAY_2 = new Date('2026-10-02T00:01:00Z');

describe('recordRead', () => {
	let db: ReturnType<typeof testDb>;
	beforeEach(() => (db = testDb()));
	const count = (path: string) =>
		(db.sqlite.prepare('SELECT count FROM views WHERE path = ?').get(path) as { count: number })
			?.count;

	it('counts a visitor once per page per day', async () => {
		expect(await recordRead(db, read('/blog/a'), always, DAY_1)).toBe(true);
		expect(await recordRead(db, read('/blog/a'), always, DAY_1_LATE)).toBe(false);
		expect(await recordRead(db, read('/blog/b'), always, DAY_1)).toBe(true);
		expect(
			await recordRead(db, read('/blog/a', { ...visitor, ip: '198.51.100.1' }), always, DAY_1)
		).toBe(true);
		expect(count('/blog/a')).toBe(2);
	});

	it('counts the same visitor again the next day, with a new salt', async () => {
		await recordRead(db, read('/blog/a'), always, DAY_1);
		const firstSalt = db.sqlite.prepare('SELECT salt FROM salts').get() as { salt: string };
		expect(await recordRead(db, read('/blog/a'), always, DAY_2)).toBe(true);
		expect(count('/blog/a')).toBe(2);
		// Yesterday's salt and hashes are gone.
		const salts = db.sqlite.prepare('SELECT day, salt FROM salts').all();
		expect(salts).toEqual([{ day: '2026-10-02', salt: expect.not.stringMatching(firstSalt.salt) }]);
		expect(db.sqlite.prepare('SELECT DISTINCT day FROM seen').all()).toEqual([
			{ day: '2026-10-02' }
		]);
	});

	it('stores no IP or User-Agent', async () => {
		await recordRead(db, read('/blog/a'), always, DAY_1);
		const dump = JSON.stringify(
			['views', 'seen', 'salts'].map((t) => db.sqlite.prepare(`SELECT * FROM ${t}`).all())
		);
		expect(dump).not.toContain(visitor.ip);
		expect(dump).not.toContain(visitor.userAgent);
	});

	it('never counts a page that does not exist', async () => {
		const asked: unknown[] = [];
		const missing = async (target: unknown) => (asked.push(target), false);
		expect(await recordRead(db, read('/blog/nope'), missing, DAY_1)).toBe(false);
		expect(asked).toEqual([{ type: 'post', slug: 'nope' }]);
		expect(count('/blog/nope')).toBeUndefined();
		// Asked once: the second try is already in `seen`.
		await recordRead(db, read('/blog/nope'), missing, DAY_1);
		expect(asked).toHaveLength(1);
	});

	it('ignores paths that are not posts or asides', async () => {
		expect(await recordRead(db, read('/resume'), always, DAY_1)).toBe(false);
		expect(db.sqlite.prepare('SELECT * FROM seen').all()).toEqual([]);
	});
});

describe('readCounts', () => {
	it('returns counts of 5 and up, for valid paths only', async () => {
		const db = testDb();
		db.sqlite.exec(`INSERT INTO views VALUES ('/blog/a', 1200), ('/blog/b', 4), ('/asides/c', 5)`);
		expect(await readCounts(db, ['/blog/a', '/blog/b', '/asides/c', '/blog/x', '/resume'])).toEqual(
			{ '/blog/a': 1200, '/asides/c': 5 }
		);
		expect(await readCounts(db, [])).toEqual({});
	});

	it(`asks for at most ${MAX_PATHS} paths`, async () => {
		const db = testDb();
		const paths = Array.from({ length: 20 }, (_, i) => `/blog/p${i}`);
		for (const path of paths) db.sqlite.prepare('INSERT INTO views VALUES (?, 10)').run(path);
		expect(Object.keys(await readCounts(db, paths))).toHaveLength(MAX_PATHS);
	});
});

describe('visitorHash', () => {
	it('depends on every part', async () => {
		const base = await visitorHash('s', 'ip', 'ua', '/blog/a');
		expect(base).toMatch(/^[0-9a-f]{64}$/);
		for (const other of [
			visitorHash('t', 'ip', 'ua', '/blog/a'),
			visitorHash('s', 'ip2', 'ua', '/blog/a'),
			visitorHash('s', 'ip', 'ua2', '/blog/a'),
			visitorHash('s', 'ip', 'ua', '/blog/b')
		])
			expect(await other).not.toBe(base);
	});
});

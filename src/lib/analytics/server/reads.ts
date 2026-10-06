// Read counts (#87, docs/view-counts.md): one count per post or aside page, in D1. A visitor counts
// once per page per UTC day, recognised by SHA-256(salt + IP + User-Agent + path) with a random salt
// for the day. Salts and hashes from earlier days are deleted, so nothing links back to a visitor;
// the IP and User-Agent are never stored.

import { entryAt } from '$lib/publishing/index.server';

/** Below this, pages show no count. */
export const READS_SHOWN_FROM = 5;
/** The most paths one GET /api/views may ask for (the home page asks for three). */
export const MAX_PATHS = 10;

/** The parts of D1 used here (`D1Database` fits; tests use node:sqlite). */
export interface Statement {
	bind(...values: unknown[]): Statement;
	run(): Promise<{ meta: { changes: number } }>;
	first<T>(): Promise<T | null>;
	all<T>(): Promise<{ results: T[] }>;
}
export interface ReadsDb {
	prepare(sql: string): Statement;
	batch(statements: Statement[]): Promise<unknown[]>;
}

/** Only entries' pages have counts: a post or an aside (the content map, #140). */
export type ReadTarget = NonNullable<ReturnType<typeof entryAt>>;

const hex = (bytes: ArrayBuffer | Uint8Array) =>
	[...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');

const utcDay = (now: Date) => now.toISOString().slice(0, 10);

/** Today's salt: made by the first read of the day, which also deletes earlier days' salts and hashes. */
async function todaysSalt(db: ReadsDb, day: string): Promise<string> {
	const fresh = hex(crypto.getRandomValues(new Uint8Array(16)));
	await db.batch([
		db.prepare('DELETE FROM salts WHERE day < ?').bind(day),
		db.prepare('DELETE FROM seen WHERE day < ?').bind(day),
		db.prepare('INSERT OR IGNORE INTO salts (day, salt) VALUES (?, ?)').bind(day, fresh)
	]);
	const row = await db.prepare('SELECT salt FROM salts WHERE day = ?').bind(day).first<{
		salt: string;
	}>();
	return row?.salt ?? fresh;
}

export async function visitorHash(salt: string, ip: string, userAgent: string, path: string) {
	const text = [salt, ip, userAgent, path].join('\n');
	return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
}

/**
 * Counts a read unless this visitor already read the page today. `exists` is asked only for a new
 * reader, so made-up paths never get a row in `views`. Returns whether the read was counted.
 */
export async function recordRead(
	db: ReadsDb,
	read: { path: string; ip: string; userAgent: string },
	exists: (target: ReadTarget) => Promise<boolean>,
	now = new Date()
): Promise<boolean> {
	const target = entryAt(read.path);
	if (!target) return false;
	const day = utcDay(now);
	const hash = await visitorHash(await todaysSalt(db, day), read.ip, read.userAgent, read.path);
	const { meta } = await db
		.prepare('INSERT OR IGNORE INTO seen (hash, day) VALUES (?, ?)')
		.bind(hash, day)
		.run();
	if (meta.changes === 0 || !(await exists(target))) return false;
	await db
		.prepare(
			'INSERT INTO views (path, count) VALUES (?, 1) ON CONFLICT (path) DO UPDATE SET count = count + 1'
		)
		.bind(read.path)
		.run();
	return true;
}

/** Counts for the given pages, leaving out any below `READS_SHOWN_FROM`. */
export async function readCounts(db: ReadsDb, paths: string[]): Promise<Record<string, number>> {
	const valid = [...new Set(paths)].filter((path) => entryAt(path)).slice(0, MAX_PATHS);
	if (valid.length === 0) return {};
	const { results } = await db
		.prepare(
			`SELECT path, count FROM views WHERE count >= ? AND path IN (${valid.map(() => '?').join(', ')})`
		)
		.bind(READS_SHOWN_FROM, ...valid)
		.all<{ path: string; count: number }>();
	return Object.fromEntries(results.map((row) => [row.path, row.count]));
}

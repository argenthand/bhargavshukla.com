#!/usr/bin/env node
// The analytics events' counts (#154, docs/analytics.md), from Workers Analytics Engine's SQL API.
// Each data point is one event: blob1 the event, blob2 the page, blob3 its value, double1 its
// seconds (read). `_sample_interval` undoes Analytics Engine's sampling, so counts are sums of it.
// Page views and Web Vitals are in Cloudflare Web Analytics, not here.
//
// Needs CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_STATS_TOKEN (an API token with Account Analytics:
// Read) in the environment or .env.
//
//   pnpm stats             # the last 30 days
//   pnpm stats --days 7

import { existsSync, readFileSync } from 'node:fs';

const DATASET = 'bs_events';

/** A setting from the environment, else from .env. */
function setting(name) {
	if (process.env[name]) return process.env[name];
	if (!existsSync('.env')) return undefined;
	const line = readFileSync('.env', 'utf8')
		.split('\n')
		.find((l) => l.startsWith(`${name}=`));
	return line?.slice(name.length + 1).trim();
}

const account = setting('CLOUDFLARE_ACCOUNT_ID');
const token = setting('CLOUDFLARE_STATS_TOKEN');
if (!account || !token) {
	console.error('Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_STATS_TOKEN (Account Analytics: Read).');
	process.exit(1);
}

const args = process.argv.slice(2);
const daysAt = args.indexOf('--days');
const days = daysAt === -1 ? 30 : Number(args[daysAt + 1]);
if (!Number.isInteger(days) || days < 1 || days > 90)
	throw new Error('--days: a whole number from 1 to 90 (Analytics Engine keeps 3 months)');

const since = `timestamp > NOW() - INTERVAL '${days}' DAY`;

async function query(sql) {
	const response = await fetch(
		`https://api.cloudflare.com/client/v4/accounts/${account}/analytics_engine/sql`,
		{ method: 'POST', headers: { authorization: `Bearer ${token}` }, body: sql }
	);
	if (!response.ok)
		throw new Error(`Analytics Engine ${response.status}: ${await response.text()}`);
	return (await response.json()).data;
}

/** Rows as a Markdown table. */
function table(headers, rows) {
	const lines = [headers, headers.map(() => '---'), ...rows];
	return lines.map((cells) => `| ${cells.join(' | ')} |`).join('\n');
}

const counts = await query(`
	SELECT blob1 AS event, blob3 AS value, SUM(_sample_interval) AS n
	FROM ${DATASET} WHERE ${since}
	GROUP BY blob1, blob3
	ORDER BY blob1, n DESC`);

const reading = await query(`
	SELECT blob2 AS page, SUM(_sample_interval) AS reports, SUM(double1 * _sample_interval) AS seconds
	FROM ${DATASET} WHERE blob1 = 'read' AND ${since}
	GROUP BY blob2
	ORDER BY seconds DESC
	LIMIT 20`);

console.log(`Last ${days} days\n`);
console.log(
	table(
		['Event', 'Value', 'Count'],
		counts.map(({ event, value, n }) => [event, value || '–', Number(n)])
	)
);
console.log('\nReading time by page (top 20)\n');
console.log(
	table(
		['Page', 'Minutes'],
		reading.map(({ page, seconds }) => [page, (Number(seconds) / 60).toFixed(1)])
	)
);

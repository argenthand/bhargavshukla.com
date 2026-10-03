#!/usr/bin/env node
// Slow-network timings for a phone (#108, docs/performance.md): Chromium with Pixel 7 emulation and
// Chrome DevTools' network presets, with JavaScript on and off. Each run starts with an empty
// browser cache, loads home, taps Writing → Resume → Asides in the tab bar, then loads home again
// with the browser cache warm. Prints medians as a Markdown table, ready for the doc.
//
//   pnpm perf                                  # https://bhargavshukla.com, 3 runs
//   pnpm perf http://localhost:8788 --runs 5   # a local build under `wrangler dev`
//
// The edge cache is warmed first, so these are cache HITs; a cold edge cache adds a Strapi trip.

import { chromium, devices } from 'playwright';

/** Chrome DevTools' presets (Fast 4G, Slow 4G, 3G): latency in ms, throughput in bytes/s. */
const NETWORKS = {
	'Fast 4G': { latency: 165, down: (9_000_000 / 8) * 0.9, up: (1_500_000 / 8) * 0.9 },
	'Slow 4G': { latency: 562.5, down: (1_600_000 / 8) * 0.9, up: (750_000 / 8) * 0.9 },
	'3G': { latency: 2000, down: (500_000 / 8) * 0.8, up: (500_000 / 8) * 0.8 }
};

const TABS = [
	['Writing', '/blog'],
	['Resume', '/resume'],
	['Asides', '/asides']
];

const args = process.argv.slice(2);
const base = (
	args.find((a) => !a.startsWith('--') && isNaN(Number(a))) ?? 'https://bhargavshukla.com'
).replace(/\/+$/, '');
const runsAt = args.indexOf('--runs');
const runs = runsAt === -1 ? 3 : Number(args[runsAt + 1]);

const median = (values) => {
	const sorted = values.filter((v) => v != null).sort((a, b) => a - b);
	return sorted.length ? sorted[Math.floor((sorted.length - 1) / 2)] : null;
};

/**
 * First and largest contentful paint of the current document, in ms from its navigation start.
 * Read from Node in a loop rather than awaited in the page: with JavaScript off the page's timers
 * never fire. `load` can come before the first paint (a page from the browser cache), so wait.
 */
async function paints(page) {
	const read = () =>
		page.evaluate(() => {
			const fcp = performance.getEntriesByName('first-contentful-paint')[0]?.startTime;
			const observer = new PerformanceObserver(() => {});
			observer.observe({ type: 'largest-contentful-paint', buffered: true });
			const lcp = observer.takeRecords().at(-1)?.startTime;
			observer.disconnect();
			return { fcp, lcp };
		});
	for (let i = 0; i < 100; i++) {
		const result = await read();
		if (result.fcp != null) return result;
		await new Promise((resolve) => setTimeout(resolve, 100));
	}
	return {};
}

/** Bytes over the wire for a step: counted until the network goes quiet, so fonts are included. */
async function settle(page) {
	await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
}

async function run(browser, network, js) {
	const context = await browser.newContext({ ...devices['Pixel 7'], javaScriptEnabled: js });
	const page = await context.newPage();
	const cdp = await context.newCDPSession(page);
	await cdp.send('Network.enable');
	const { latency, down, up } = NETWORKS[network];
	await cdp.send('Network.emulateNetworkConditions', {
		offline: false,
		latency,
		downloadThroughput: down,
		uploadThroughput: up
	});
	let bytes = 0;
	let documents = 0;
	let data = 0;
	cdp.on('Network.loadingFinished', (e) => (bytes += e.encodedDataLength));
	page.on('request', (r) => {
		if (r.resourceType() === 'document') documents++;
		if (r.url().includes('__data.json')) data++;
	});
	const reset = () => {
		bytes = 0;
		documents = 0;
		data = 0;
	};

	const results = {};
	const load = async (label) => {
		reset();
		const start = Date.now();
		await page.goto(`${base}/`, { waitUntil: 'load' });
		const ms = Date.now() - start;
		const timings = await paints(page);
		await settle(page);
		results[label] = { ms, ...timings, kb: bytes / 1024 };
	};

	await load('First visit: home');
	for (const [tab, path] of TABS) {
		await page.waitForTimeout(1000); // idle time, as a reader would have
		reset();
		const start = Date.now();
		await page.locator('nav[aria-label=Primary] a', { hasText: tab }).last().tap();
		await page.waitForURL(`${base}${path}`);
		await page.waitForLoadState('load');
		if (js) await page.waitForFunction(() => !document.querySelector('[role=progressbar]'));
		const ms = Date.now() - start;
		// A full page load (JS off, or the old fallback) has its own paint timings.
		const timings = documents > 0 ? await paints(page) : {};
		await settle(page);
		results[`Tap ${tab}`] = { ms, ...timings, kb: bytes / 1024, documents, data };
	}
	await page.waitForTimeout(1000);
	await load('Return visit: home');

	await context.close();
	return results;
}

const browser = await chromium.launch();
// Warm the edge cache: requests land on more than one data centre, so ask a few times.
for (const path of ['/', ...TABS.map(([, p]) => p)])
	for (let i = 0; i < 4; i++) await fetch(`${base}${path}`);

const fmt = (v, unit = '') => (v == null ? '–' : `${Math.round(v)}${unit}`);
console.log(`Target: ${base} · ${new Date().toISOString().slice(0, 10)} · ${runs} runs, medians\n`);
console.log('| Network | JS | Step | Total (ms) | FCP (ms) | LCP (ms) | KB | Requests |');
console.log('| --- | --- | --- | --- | --- | --- | --- | --- |');
for (const network of Object.keys(NETWORKS)) {
	for (const js of [true, false]) {
		const all = [];
		for (let i = 0; i < runs; i++) {
			const t = Date.now();
			all.push(await run(browser, network, js));
			console.error(
				`${network}, JS ${js ? 'on' : 'off'}, run ${i + 1}: ${Math.round((Date.now() - t) / 1000)} s`
			);
		}
		for (const step of Object.keys(all[0])) {
			const pick = (k) => median(all.map((r) => r[step][k]));
			const requests = step.startsWith('Tap')
				? `${fmt(pick('documents'))} page, ${fmt(pick('data'))} data`
				: '';
			console.log(
				`| ${network} | ${js ? 'on' : 'off'} | ${step} | ${fmt(pick('ms'))} | ${fmt(pick('fcp'))} | ${fmt(pick('lcp'))} | ${fmt(pick('kb'))} | ${requests} |`
			);
		}
	}
}
await browser.close();

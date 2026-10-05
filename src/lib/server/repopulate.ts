// Repopulate after a purge (#123, docs/caching.md → Purge endpoint): fetch pages again through
// Workers Cache, so the next visitor gets the new version from cache instead of being the one who
// renders it. Which URLs is the content map's call (`planPublish`, #140); pages it leaves out
// render on their next visit.

/**
 * Fetches each URL (a few at a time, so Strapi isn't flooded) and logs what Workers Cache said.
 * `fetchPage` goes through the Worker's own cache: a loopback request, not the public internet.
 */
export async function repopulate(
	urls: string[],
	fetchPage: (path: string) => Promise<Response>,
	concurrency = 4
): Promise<{ ok: number; failed: string[] }> {
	const queue = [...urls];
	const failed: string[] = [];
	let ok = 0;
	const statuses: string[] = [];
	async function worker() {
		for (let path = queue.shift(); path !== undefined; path = queue.shift()) {
			try {
				const res = await fetchPage(path);
				await res.arrayBuffer(); // read it all, so the response is stored
				statuses.push(`${path} ${res.status} ${res.headers.get('cf-cache-status') ?? '-'}`);
				if (res.ok) ok++;
				else failed.push(path);
			} catch (err) {
				failed.push(path);
				statuses.push(`${path} error ${String(err)}`);
			}
		}
	}
	await Promise.all(Array.from({ length: Math.min(concurrency, urls.length) }, worker));
	console.log(`Repopulate: ${ok}/${urls.length} ok. ${statuses.join('; ')}`);
	return { ok, failed };
}

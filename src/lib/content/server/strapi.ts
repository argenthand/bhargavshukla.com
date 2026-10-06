// Typed read-only client for Strapi's REST API (docs/caching.md → Strapi client).
// Every read records the content types it shows as cache tags (the content map, #140), which the
// edge cache (#16) and purge (#17) use.

import { env } from '$env/dynamic/private';
import { error } from '@sveltejs/kit';
import qs from 'qs';
import type { Page } from '../types';
import {
	CONTENT_TYPES,
	readTags,
	type ContentType,
	type SingleType
} from '$lib/server/content-map';

export type Query = Record<string, unknown>;

export function buildUrl(base: string, type: ContentType, query: Query = {}): string {
	const search = qs.stringify(query, { encodeValuesOnly: true });
	return `${base.replace(/\/+$/, '')}/api/${CONTENT_TYPES[type].api}${search ? `?${search}` : ''}`;
}

/** Strapi media URLs are relative for local uploads and absolute for R2. */
export function mediaUrl(url: string): string {
	return /^https?:\/\//.test(url) ? url : `${(env.STRAPI_URL ?? '').replace(/\/+$/, '')}${url}`;
}

export function strapi(locals: App.Locals, fetcher: typeof fetch = fetch) {
	async function request(type: ContentType, query: Query): Promise<Response> {
		for (const tag of readTags(type, query)) locals.cacheTags.add(tag);

		const { STRAPI_URL, STRAPI_TOKEN } = env;
		if (!STRAPI_URL || !STRAPI_TOKEN) error(500, 'STRAPI_URL and STRAPI_TOKEN must be set');

		return fetcher(buildUrl(STRAPI_URL, type, query), {
			headers: { Authorization: `Bearer ${STRAPI_TOKEN}` }
		});
	}

	async function find<T>(type: ContentType, query: Query = {}): Promise<Page<T>> {
		const res = await request(type, query);
		if (!res.ok) error(502, `Strapi ${res.status} for ${CONTENT_TYPES[type].api}`);
		return (await res.json()) as Page<T>;
	}

	/** A single type's entry, or undefined when it hasn't been saved yet (Strapi answers 404). */
	async function get<T>(type: SingleType, query: Query = {}): Promise<T | undefined> {
		const res = await request(type, query);
		if (res.status === 404) return undefined;
		if (!res.ok) error(502, `Strapi ${res.status} for ${CONTENT_TYPES[type].api}`);
		return ((await res.json()) as { data: T }).data;
	}

	/** Every page of a collection (Strapi caps pageSize at 100). */
	async function findAll<T>(type: ContentType, query: Query = {}): Promise<T[]> {
		const all: T[] = [];
		for (let page = 1; ; page++) {
			const res = await find<T>(type, { ...query, pagination: { page, pageSize: 100 } });
			all.push(...res.data);
			if (page >= res.meta.pagination.pageCount) return all;
		}
	}

	return { find, findAll, get };
}

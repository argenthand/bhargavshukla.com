// Typed read-only client for Strapi's REST API (docs/caching.md → Strapi client).
// Every call records a `type:<model>` cache tag, which the edge cache (#16) and purge (#17) use.

import { env } from '$env/dynamic/private';
import { error } from '@sveltejs/kit';
import qs from 'qs';
import type { Page } from '$lib/types/content';

export const MODELS = {
	post: 'posts',
	category: 'categories',
	profile: 'profile',
	resume: 'resume',
	aside: 'asides',
	tag: 'tags'
} as const;

/** Single types: GET returns one entry, not a page. */
type SingleModel = 'profile' | 'resume';

export type Model = keyof typeof MODELS;

/** Relations whose content ends up on the page, so editing them must purge it too. */
const RELATION_MODELS: Record<string, Model> = {
	category: 'category',
	related: 'post',
	tags: 'tag'
};

export type Query = Record<string, unknown>;

export function buildUrl(base: string, model: Model, query: Query = {}): string {
	const search = qs.stringify(query, { encodeValuesOnly: true });
	return `${base.replace(/\/+$/, '')}/api/${MODELS[model]}${search ? `?${search}` : ''}`;
}

/** Models a query reads: the model itself plus any populated relation that maps to one. */
export function tagsFor(model: Model, query: Query = {}): string[] {
	const tags = new Set([`type:${model}`]);
	const populate = query.populate;
	const keys =
		typeof populate === 'string'
			? [populate]
			: Array.isArray(populate)
				? populate
				: populate && typeof populate === 'object'
					? Object.keys(populate)
					: [];
	for (const key of keys) {
		const related = RELATION_MODELS[key];
		if (related) tags.add(`type:${related}`);
	}
	return [...tags];
}

/** Strapi media URLs are relative for local uploads and absolute for R2. */
export function mediaUrl(url: string): string {
	return /^https?:\/\//.test(url) ? url : `${(env.STRAPI_URL ?? '').replace(/\/+$/, '')}${url}`;
}

export function strapi(locals: App.Locals, fetcher: typeof fetch = fetch) {
	async function request(model: Model, query: Query): Promise<Response> {
		for (const tag of tagsFor(model, query)) locals.cacheTags.add(tag);

		const { STRAPI_URL, STRAPI_TOKEN } = env;
		if (!STRAPI_URL || !STRAPI_TOKEN) error(500, 'STRAPI_URL and STRAPI_TOKEN must be set');

		return fetcher(buildUrl(STRAPI_URL, model, query), {
			headers: { Authorization: `Bearer ${STRAPI_TOKEN}` }
		});
	}

	async function find<T>(model: Model, query: Query = {}): Promise<Page<T>> {
		const res = await request(model, query);
		if (!res.ok) error(502, `Strapi ${res.status} for ${MODELS[model]}`);
		return (await res.json()) as Page<T>;
	}

	/** A single type's entry, or undefined when it hasn't been saved yet (Strapi answers 404). */
	async function get<T>(model: SingleModel, query: Query = {}): Promise<T | undefined> {
		const res = await request(model, query);
		if (res.status === 404) return undefined;
		if (!res.ok) error(502, `Strapi ${res.status} for ${MODELS[model]}`);
		return ((await res.json()) as { data: T }).data;
	}

	/** Every page of a collection (Strapi caps pageSize at 100). */
	async function findAll<T>(model: Model, query: Query = {}): Promise<T[]> {
		const all: T[] = [];
		for (let page = 1; ; page++) {
			const res = await find<T>(model, { ...query, pagination: { page, pageSize: 100 } });
			all.push(...res.data);
			if (page >= res.meta.pagination.pageCount) return all;
		}
	}

	return { find, findAll, get };
}

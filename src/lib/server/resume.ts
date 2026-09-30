// The Resume single type (#5). Only the published version is served; drafts stay in the admin.

import type { Resume } from '$lib/types/content';
import { renderMarkdown } from './markdown';
import { strapi } from './strapi';

export async function getResume(locals: App.Locals) {
	const resume = await strapi(locals).get<Resume>('resume', {
		populate: { experience: true, skillGroups: true, education: true }
	});
	if (!resume) return undefined;
	return {
		location: resume.location,
		summary: resume.summary,
		updatedAt: resume.updatedAt,
		// Newest role first, whatever order they were entered in.
		experience: [...(resume.experience ?? [])]
			.sort((a, b) => b.startDate.localeCompare(a.startDate))
			.map(({ highlights, ...job }) => ({
				...job,
				highlightsHtml: highlights ? renderMarkdown(highlights).html : ''
			})),
		skillGroups: resume.skillGroups ?? [],
		education: resume.education ?? []
	};
}

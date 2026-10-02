// The Resume single type (#5). Only the published version is served, except in draft preview (#57).

import type { Resume } from '$lib/types/content';
import { renderMarkdown } from './markdown';
import { strapi } from './strapi';

type Job = Resume['experience'][number];

export interface Role {
	role: string;
	/** Only when it differs from the company's (the newest role's) location. */
	location: string | null;
	startDate: string;
	endDate: string | null;
	highlightsHtml: string;
}

/** One company heading over every role held there back to back (#94): a promotion shows as two roles. */
export interface Employer {
	company: string;
	location: string | null;
	startDate: string;
	/** Empty while any role there is current (Present). */
	endDate: string | null;
	roles: Role[];
}

/** Newest role first; roles in a row at the same company share one heading, newest role first. */
export function groupByEmployer(jobs: Job[]): Employer[] {
	const sorted = [...jobs].sort((a, b) => b.startDate.localeCompare(a.startDate));
	const employers: Employer[] = [];
	for (const { role, company, location, startDate, endDate, highlights } of sorted) {
		let employer = employers.at(-1);
		if (employer?.company !== company) {
			employer = { company, location, startDate, endDate, roles: [] };
			employers.push(employer);
		}
		employer.startDate = startDate;
		if (employer.endDate && (!endDate || endDate > employer.endDate)) employer.endDate = endDate;
		employer.roles.push({
			role,
			location: location === employer.location ? null : location,
			startDate,
			endDate,
			highlightsHtml: highlights ? renderMarkdown(highlights).html : ''
		});
	}
	return employers;
}

export async function getResume(locals: App.Locals, { drafts = false }: { drafts?: boolean } = {}) {
	const resume = await strapi(locals).get<Resume>('resume', {
		...(drafts && { status: 'draft' }),
		populate: { experience: true, skillGroups: true, education: true, certifications: true }
	});
	if (!resume) return undefined;
	return {
		location: resume.location,
		summary: resume.summary,
		updatedAt: resume.updatedAt,
		employers: groupByEmployer(resume.experience ?? []),
		skillGroups: resume.skillGroups ?? [],
		education: resume.education ?? [],
		certifications: resume.certifications ?? []
	};
}

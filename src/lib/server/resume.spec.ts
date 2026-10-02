import { describe, expect, it, vi } from 'vitest';
import type { Resume } from '$lib/types/content';

vi.mock('$env/dynamic/private', () => ({ env: {} }));

const { groupByEmployer } = await import('./resume');

type Job = Resume['experience'][number];

const job = (role: string, company: string, startDate: string, extra: Partial<Job> = {}): Job => ({
	role,
	company,
	location: 'Toronto, ON',
	startDate,
	endDate: null,
	highlights: null,
	...extra
});

describe('groupByEmployer', () => {
	it('puts back-to-back roles at one company under one heading, newest first', () => {
		const employers = groupByEmployer([
			job('Senior Engineer', 'Acme', '2021-01-04', { endDate: '2021-04-01' }),
			job('Engineer', 'Initech', '2019-05-01', { endDate: '2020-12-31' }),
			job('Lead Developer', 'Acme', '2021-04-01')
		]);
		expect(employers.map((e) => [e.company, e.roles.map((r) => r.role)])).toEqual([
			['Acme', ['Lead Developer', 'Senior Engineer']],
			['Initech', ['Engineer']]
		]);
	});

	it('spans the company from the first start to the last end', () => {
		const [acme] = groupByEmployer([
			job('Lead', 'Acme', '2021-04-01', { endDate: '2024-06-30' }),
			job('Senior', 'Acme', '2021-01-04', { endDate: '2021-04-01' })
		]);
		expect([acme.startDate, acme.endDate]).toEqual(['2021-01-04', '2024-06-30']);
	});

	it('ends in the present while any role there is current', () => {
		const [acme] = groupByEmployer([
			job('Lead', 'Acme', '2021-04-01'),
			job('Senior', 'Acme', '2021-01-04', { endDate: '2021-04-01' })
		]);
		expect(acme.endDate).toBeNull();
	});

	it('shows a role’s location only when it differs from the company’s', () => {
		const [acme] = groupByEmployer([
			job('Lead', 'Acme', '2022-01-01', { location: 'Remote' }),
			job('Senior', 'Acme', '2021-01-01', { location: 'Toronto, ON' }),
			job('Junior', 'Acme', '2020-01-01', { location: 'Remote' })
		]);
		expect(acme.location).toBe('Remote');
		expect(acme.roles.map((r) => r.location)).toEqual([null, 'Toronto, ON', null]);
	});

	it('gives a company left and rejoined two headings', () => {
		const employers = groupByEmployer([
			job('Again', 'Acme', '2023-01-01'),
			job('Elsewhere', 'Initech', '2021-01-01', { endDate: '2022-12-31' }),
			job('First', 'Acme', '2019-01-01', { endDate: '2020-12-31' })
		]);
		expect(employers.map((e) => e.company)).toEqual(['Acme', 'Initech', 'Acme']);
	});

	it('renders highlights to HTML', () => {
		const [acme] = groupByEmployer([
			job('Lead', 'Acme', '2021-01-01', { highlights: '- Shipped' })
		]);
		expect(acme.roles[0].highlightsHtml).toContain('<li>Shipped</li>');
	});
});

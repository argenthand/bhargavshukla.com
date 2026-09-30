<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';
	import { site } from '$lib/site';

	// F-home-v2 intro. The featured posts and "View all writing" come with the blog routes (#9).
	const links = [
		{ href: '/resume', label: 'Resume', icon: 'arrow-right', size: 16 },
		{ href: `mailto:${site.email}`, label: 'Email', icon: 'mail', size: 14 },
		{ href: site.linkedin, label: 'LinkedIn', icon: 'external', size: 14, external: true },
		{ href: site.github, label: 'GitHub', icon: 'external', size: 14, external: true }
	] as const;
</script>

<svelte:head>
	<title>{site.name}</title>
</svelte:head>

<div class="mx-auto max-w-5xl px-5 md:px-8">
	<section
		aria-label="About"
		class="flex flex-col gap-4 py-10 md:pt-14 lg:grid lg:grid-cols-12 lg:gap-8 lg:pt-16 lg:pb-14"
	>
		<div class="lg:col-span-5">
			<h1 class="text-4xl/[1.1] font-medium tracking-tight">{site.name}</h1>
			<p class="mt-2 text-xl text-neutral-600 italic dark:text-neutral-400">{site.tagline}</p>
		</div>
		<div
			class="flex flex-col gap-4 text-lg/[1.7] text-neutral-700 lg:col-span-7 dark:text-neutral-300"
		>
			<p>
				Hey there. I'm a full-stack dev turned Engineering Manager who spends most of my time
				working with .NET and TypeScript. Over the last few years, I've jumped across a bunch of
				different stacks, including everything from Django + Vue on AWS to React + React Native +
				.NET on Azure. Domain-wise, I've moved around a fair bit too, building software for
				logistics, healthcare, P&C insurance, and currently, fintech.
			</p>
			<p>
				After serving as Tech Lead for my team since 2024, I recently made the leap into the
				Engineering Manager role. Trading the deep focus of IC work for 1-on-1s, hiring, and team
				roadmap strategy has been great, but it is definitely a completely different ballgame.
			</p>
			<p>
				That transition is the main reason I started this blog. I wanted a place to write about
				going from IC to EM in real time, focusing on the daily friction, the soft skills you can't
				really prepare for, and how to stay useful technically without micromanaging the people
				around you.
			</p>
			<ul class="flex flex-wrap items-center gap-x-5 gap-y-1">
				{#each links as link (link.label)}
					<li>
						<!-- eslint-disable svelte/no-navigation-without-resolve -- /resume arrives in #5; the rest are external -->
						<a
							href={link.href}
							target={'external' in link ? '_blank' : undefined}
							rel={'external' in link ? 'noopener noreferrer' : undefined}
							class="inline-flex min-h-11 items-center gap-1.5 text-red-700 underline decoration-1 underline-offset-4 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
						>
							{link.label}<Icon name={link.icon} size={link.size} />
							{#if 'external' in link}<span class="sr-only"> (opens in a new tab)</span>{/if}
						</a>
						<!-- eslint-enable svelte/no-navigation-without-resolve -->
					</li>
				{/each}
			</ul>
		</div>
	</section>
</div>

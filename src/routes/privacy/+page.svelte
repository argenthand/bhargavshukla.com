<script lang="ts">
	// PRIV-* (#154, docs/analytics.md): the privacy note, linked from the footer. The copy (the lead
	// and the sections) comes from the Strapi Privacy single type.
	import { Prose } from '$lib/content';
	import { Seo } from '$lib/site';

	let { data } = $props();
</script>

<Seo title="Privacy" description={data.privacy.lead} />

<div class="page">
	<header class="page-header">
		<h1 class="page-title">Privacy</h1>
		<p class="standfirst">{data.privacy.lead}</p>
	</header>
	<div class="mx-auto max-w-article">
		<Prose html={data.privacy.html} />
	</div>
</div>

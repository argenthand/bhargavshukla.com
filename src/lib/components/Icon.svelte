<script lang="ts" module>
	export type IconName =
		| 'arrow-right'
		| 'mail'
		| 'rss'
		| 'pen'
		| 'code'
		| 'file'
		| 'search'
		| 'chevron-down'
		| 'list'
		| 'close'
		| 'printer'
		| 'globe'
		| 'arrow-left'
		| 'arrow-up'
		| 'github'
		| 'linkedin'
		| 'sun'
		| 'moon'
		| 'monitor'
		| 'note';
</script>

<script lang="ts">
	// Every icon is from Feather Icons 4.29.2 (MIT, © Cole Bemis, feathericons.com; #79, #80), drawn at
	// the site's 1.75 stroke. The names say what they're for; a comment names the Feather icon where
	// it differs. Decorative only: the text next to them is the label.
	let {
		name,
		size = 16,
		class: className = ''
	}: { name: IconName; size?: number; class?: string } = $props();
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width="1.75"
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
	data-icon={name}
	class="shrink-0 {className}"
>
	{#if name === 'arrow-right'}
		<line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
	{:else if name === 'mail'}
		<path
			d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"
		/><polyline points="22,6 12,13 2,6" />
	{:else if name === 'rss'}
		<path d="M4 11a9 9 0 0 1 9 9" /><path d="M4 4a16 16 0 0 1 16 16" /><circle
			cx="5"
			cy="19"
			r="1"
		/>
	{:else if name === 'pen'}
		<!-- Feather: edit-3 -->
		<path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
	{:else if name === 'code'}
		<polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
	{:else if name === 'file'}
		<!-- Feather: file-text -->
		<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline
			points="14 2 14 8 20 8"
		/><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline
			points="10 9 9 9 8 9"
		/>
	{:else if name === 'search'}
		<circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
	{:else if name === 'chevron-down'}
		<polyline points="6 9 12 15 18 9" />
	{:else if name === 'list'}
		<line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line
			x1="8"
			y1="18"
			x2="21"
			y2="18"
		/><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line
			x1="3"
			y1="18"
			x2="3.01"
			y2="18"
		/>
	{:else if name === 'close'}
		<!-- Feather: x -->
		<line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
	{:else if name === 'printer'}
		<polyline points="6 9 6 2 18 2 18 9" /><path
			d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"
		/><rect x="6" y="14" width="12" height="8" />
	{:else if name === 'globe'}
		<circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path
			d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"
		/>
	{:else if name === 'arrow-left'}
		<line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
	{:else if name === 'arrow-up'}
		<line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />
	{:else if name === 'github'}
		<path
			d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"
		/>
	{:else if name === 'linkedin'}
		<path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" /><rect
			x="2"
			y="9"
			width="4"
			height="12"
		/><circle cx="4" cy="4" r="2" />
	{:else if name === 'sun'}
		<circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line
			x1="12"
			y1="21"
			x2="12"
			y2="23"
		/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line
			x1="18.36"
			y1="18.36"
			x2="19.78"
			y2="19.78"
		/><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line
			x1="4.22"
			y1="19.78"
			x2="5.64"
			y2="18.36"
		/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
	{:else if name === 'moon'}
		<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
	{:else if name === 'monitor'}
		<rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line
			x1="8"
			y1="21"
			x2="16"
			y2="21"
		/><line x1="12" y1="17" x2="12" y2="21" />
	{:else if name === 'note'}
		<!-- Feather: bookmark -->
		<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
	{/if}
</svg>

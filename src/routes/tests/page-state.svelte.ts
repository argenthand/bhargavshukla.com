// A stand-in for SvelteKit's `page` that is reactive, so a spec can navigate by assigning `url`.
export const page = $state({
	url: { pathname: '/blog', search: '' },
	error: null as unknown,
	route: { id: '/blog' }
});

// The look's first-paint script (#141). Sent to the page as this file's text, never bundled (see
// look-boot.ts): bundlers add helpers that don't exist on a page before anything has loaded.
// Applies the saved theme, palette and 8-bit mode to <html>, and keeps following the device's light
// or dark while the theme is System. `config` comes from look-boot.ts; left unfilled, every lookup
// throws inside its `try` and the page keeps the defaults.
/** @param {{ keys: { theme: string; palette: string; eightBit: string }; palettes: string[] }} config */
(function (config) {
	var root = document.documentElement;
	var theme = 'system';
	try {
		theme = localStorage.getItem(config.keys.theme) || 'system';
	} catch {
		// Storage blocked: System.
	}
	if (theme !== 'light' && theme !== 'dark') theme = 'system';
	var system = matchMedia('(prefers-color-scheme: dark)');
	function apply() {
		var t = root.dataset.themePref;
		root.dataset.theme = t === 'dark' || (t === 'system' && system.matches) ? 'dark' : 'light';
	}
	root.dataset.themePref = theme;
	apply();
	try {
		var palette = localStorage.getItem(config.keys.palette);
		if (palette && config.palettes.indexOf(palette) !== -1) root.dataset.palette = palette;
	} catch {
		// Storage blocked: the default palette.
	}
	try {
		if (sessionStorage.getItem(config.keys.eightBit) === '1')
			root.setAttribute('data-eight-bit', '');
	} catch {
		// Storage blocked: no 8-bit mode.
	}
	system.addEventListener('change', apply);
})(/*config*/ JSON.parse('{}'));

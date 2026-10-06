// The look domain's interface. Import from here, not from the files behind it.
export { bootScript } from './boot/look-boot';
export { default as EightBitBanner } from './components/EightBitBanner.svelte';
export { default as PalettePicker } from './components/PalettePicker.svelte';
export { default as Shortcuts } from './components/Shortcuts.svelte';
export { default as ThemeToggle } from './components/ThemeToggle.svelte';
export { ABYSS_LINE, consoleNote, notFoundLine } from './easter-eggs/easter-eggs';
export { bouncedPastEnd, konamiKeydown, taps } from './easter-eggs/gestures';
export { introHeading, watchIntro } from './easter-eggs/intro.svelte';
export { wake } from './eight-bit/eight-bit-sound';
export { look } from './look.svelte';

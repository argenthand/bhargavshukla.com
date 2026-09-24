// @ts-check
import { defineConfig } from 'astro/config';
import { satteri } from '@astrojs/markdown-satteri';
import satteriCallouts from 'satteri-callouts';

// https://astro.build/config
export default defineConfig({
  markdown: {
    // Callouts are written as blockquotes: `> [!NOTE] Optional title`.
    processor: satteri({ hastPlugins: [satteriCallouts()] }),
    shikiConfig: {
      themes: { light: 'github-light-high-contrast', dark: 'github-dark-high-contrast' },
      defaultColor: false,
    },
  },
});

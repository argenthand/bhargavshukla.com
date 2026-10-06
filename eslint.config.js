import prettier from 'eslint-config-prettier';
import path from 'node:path';
import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import { defineConfig, includeIgnoreFile } from 'eslint/config';
import globals from 'globals';
import ts from 'typescript-eslint';

const gitignorePath = path.resolve(import.meta.dirname, '.gitignore');

const domains = ['site', 'content', 'look', 'analytics', 'contact', 'publishing'];
const domainPatterns = [
	{
		group: ['$lib/*/*', '!$lib/*/index.server', '!$lib/look/palettes', '!$lib/fonts/*'],
		message: 'Import a domain through its interface: $lib/<domain> or $lib/<domain>/index.server.'
	},
	{
		regex: `^(\\.\\./)+(${domains.join('|')})/`,
		message: 'Import another domain through its interface: $lib/<domain>.'
	}
];

export default defineConfig(
	includeIgnoreFile(gitignorePath),
	// Strapi app with its own npm project and tooling (#7)
	{ ignores: ['cms/'] },
	js.configs.recommended,
	ts.configs.recommended,
	svelte.configs.recommended,
	prettier,
	svelte.configs.prettier,
	{
		languageOptions: { globals: { ...globals.browser, ...globals.node } },
		rules: {
			// typescript-eslint strongly recommend that you do not use the no-undef lint rule on TypeScript projects.
			// see: https://typescript-eslint.io/troubleshooting/faqs/eslint/#i-get-errors-from-the-no-undef-rule-about-global-variables-not-being-defined-even-though-there-are-no-typescript-errors
			'no-undef': 'off'
		}
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		languageOptions: {
			parserOptions: {
				projectService: true,
				extraFileExtensions: ['.svelte'],
				parser: ts.parser
			}
		}
	},
	{
		// src/lib is split into domains (#157). Code reaches a domain only through its interface:
		// `$lib/<domain>`, or `$lib/<domain>/index.server` for server code. `look/palettes` is the
		// one exception: a dependency-free leaf that analytics reads without a cycle.
		files: ['src/**/*.{ts,js,svelte}'],
		ignores: ['**/*.spec.ts'],
		rules: { '@typescript-eslint/no-restricted-imports': ['error', { patterns: domainPatterns }] }
	},
	{
		// SvelteKit only guards `index.server` and `$lib/server`, not a domain's own server/ folder.
		// So client code in a domain must not import it, except for its types.
		files: ['src/lib/*/**/*.{ts,js,svelte}'],
		ignores: [
			'src/lib/*/server/**',
			'src/lib/*/tests/**',
			'src/lib/*/index.server.ts',
			'**/*.spec.ts'
		],
		rules: {
			'@typescript-eslint/no-restricted-imports': [
				'error',
				{
					patterns: [
						...domainPatterns,
						{
							regex: '(^|/)server/|index\\.server$',
							allowTypeImports: true,
							message:
								'Client code cannot import server code. Share a type, or go through the server.'
						}
					]
				}
			]
		}
	},
	{
		// Override or add rule settings here, such as:
		// 'svelte/button-has-type': 'error'
		rules: {}
	}
);

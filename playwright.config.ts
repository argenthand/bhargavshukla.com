import { defineConfig } from '@playwright/test';

// Tests run against a build of the sample content in test-content/, never the private content repo.
export default defineConfig({
  testDir: './e2e',
  webServer: {
    command: 'CONTENT_PATH=./test-content pnpm astro build && pnpm astro preview --port 4321 --ignore-lock',
    url: 'http://localhost:4321',
    reuseExistingServer: false,
  },
  use: { baseURL: 'http://localhost:4321' },
  projects: [
    { name: 'light', use: { browserName: 'chromium', colorScheme: 'light' } },
    { name: 'dark', use: { browserName: 'chromium', colorScheme: 'dark' } },
  ],
});

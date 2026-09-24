# Content lives in a private repo and is fetched by GitHub Actions at build time

This code repo is public, but Posts, Snippets, Resume content and CMS-uploaded images must stay private until published (Drafts and Scheduled items included). So Sveltia CMS writes to a separate private content repo, and a GitHub Actions workflow in this repo checks out that repo's latest default branch at build time, authenticating as a GitHub App installed on both repos. The build runs in Actions and only the production output leaves the job; the content commit SHA is recorded with each build for traceability.

## Considered Options

- **Content in this repo**: rejected; publishing the code would publish Drafts and Scheduled items.
- **Git submodule pinned to a content commit**: rejected; every CMS save would need a second commit here to bump the pin, and the public repo would expose the private repo's name and commit history.
- **Build on the host (Netlify/Vercel/Cloudflare Pages)**: rejected; credentials and content would live in a second place outside our control.
- **Deploy key + personal access token instead of a GitHub App**: rejected; the token expires and fails without warning, and a GitHub App's short-lived tokens cover both directions (reading content, and the content repo telling this repo to rebuild).

## Consequences

- Builds are triggered by a push to `main`, a content-repo change (the latest build wins), a manual run, and a nightly schedule shortly after midnight America/Toronto. Scheduled items only go live through the nightly build.
- A public repo's Actions logs and uploaded build files are public: the private content is only fetched on `main`, scheduled and manual builds, never on pull requests, and raw content is never uploaded or printed to logs. Pull requests build and test with the sample test content only.
- GitHub turns off a public repo's schedule after 60 days with no activity; content-triggered builds keep it active, but a long writing break could silently stop Scheduled publishing.
- Local development reads content from a local clone of the content repo, pointed to by an environment variable, and falls back to the sample test content when it's not set.

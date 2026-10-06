## Project Configuration

- **Language**: TypeScript
- **Package Manager**: pnpm
- **Add-ons**: eslint, prettier, tailwindcss, vitest, ai-tools

---

You are able to use the Svelte MCP server, where you have access to comprehensive Svelte 5 and SvelteKit documentation. Here's how to use the available tools effectively:

## Available Svelte MCP Tools:

### 1. list-sections

Use this FIRST to discover all available documentation sections. Returns a structured list with titles, use_cases, and paths.
When asked about Svelte or SvelteKit topics, ALWAYS use this tool at the start of the chat to find relevant sections.

### 2. get-documentation

Retrieves full documentation content for specific sections. Accepts single or multiple sections.
After calling the list-sections tool, you MUST analyze the returned documentation sections (especially the use_cases field) and then use the get-documentation tool to fetch ALL documentation sections that are relevant for the user's task.

### 3. svelte-autofixer

Analyzes Svelte code and returns issues and suggestions.
You MUST use this tool whenever writing Svelte code before sending it to the user. Keep calling it until no issues or suggestions are returned.

### 4. playground-link

Generates a Svelte Playground link with the provided code.
After completing the code, ask the user if they want a playground link. Only call this tool after user confirmation and NEVER if code was written to files in their project.

## Code layout

`src/lib` is split by domain (see `docs/routes.md`). Import a domain only through its `index.ts` or `index.server.ts`; ESLint fails on anything deeper. Put specs in the domain's `tests/` folder, mirroring its layout (routes: `src/routes/tests/`).

## Agent skills

### Issue tracker

GitHub Issues on argenthand/bhargavshukla.com, via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five defaults (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

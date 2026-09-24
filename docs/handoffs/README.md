# Handoffs

Notes one session leaves for the next, kept permanently as an audit trail. Never edit or delete a past handoff; write a new one instead.

## Naming

`YYYY-MM-DD-HHMM-<slug>.md`, using local time (America/Toronto) when the handoff was written, and a short kebab-case slug describing the next session's focus. For example, `2026-09-23-2330-implement-mvp-tickets.md`. The timestamp prefix keeps files in chronological order, and the time keeps same-day handoffs from colliding.

## Header

Every handoff starts with a title, then:

- **Date:** the date and time it was written, with timezone
- **Previous handoff:** the file name of the one before it, or "none (first)"
- **Next session focus:** one line
- **Repo state:** branch and commit at the time of writing

## Reading

At the start of a session, read the newest file here (the last one in name order). Follow its "Previous handoff" link only when you need older context.

## Contents

Reference specs, issues, ADRs and commits by URL or path instead of copying them. Never include secrets, tokens, email addresses or local machine paths: this repo is public.

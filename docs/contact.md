# Contact form (#135)

The email address is gone from the site. A card at the bottom of every page sends a message instead, and the address only appears on the printed resume. Mockups: CONTACT-\* on the design canvas.

## What visitors see

- **The card** (`ContactCard.svelte`), above the footer on every page except the error page, and never in print. It has three fields:
  - **From:** the reply address.
  - **Subject:** up to 150 characters.
  - **Message:** up to 1,000 characters, with a counter.
- **The header** on home and the resume: **Send a message** in place of the email. It scrolls to the card (`#contact`) and isn't printed.
- **The printed resume:** the profile's email, first in the contact list (paper and PDF only).

## Checks, with JavaScript

- **Leaving a field checks it.** An empty field waits for Send. Once a field has an error, every keystroke checks it again, so the error clears as it's fixed. A message over 1,000 characters is flagged as you type, and the extra text stays.
- **An error** turns the field's outline red (`field` with `aria-invalid`) and adds a message under it, linked with `aria-describedby`.
- **Send** looks inactive (`aria-disabled`, 40% opacity) while anything is missing or wrong. It stays focusable, and pressing it shows every error and focuses the first.
- **Send posts in the background** (`use:enhance`). The card then shows **Message sent**, or a red line if sending failed, with everything typed still in place.
- **Colours:** Send is in the palette's `accent`. Errors use the new `danger` role: red in every palette, `red-400` in dark mode, the NES red in 8-bit mode.

The rules live in `src/lib/contact/contact.ts`, shared by the card and the server, so both give the same messages.

## Without JavaScript

The browser checks the basics (`required`, `type=email`, `maxlength`) and posts to the page it's on: `?/contact#contact`. The server answers with that same page, scrolled to the card, showing the confirmation, or the errors with everything typed kept.

- **Layouts can't have form actions**, so every page route exports `actions = pageActions` (`src/lib/publishing/server/page-load.ts`, #142). `src/routes/pages.spec.ts` fails if a page route is missing it; without it, a visitor without JavaScript would get a 405.
- **The URL** after a post is `…?/contact#contact`, SvelteKit's standard address for a form action.

## Spam

In the order the server checks:

1. **Honeypot:** a `company` field hidden from people and screen readers. If it's filled, the server answers "sent" and sends nothing.
2. **Field checks:** the same rules as the browser.
3. **Rate limit:** 3 sends a minute per IP, with the Workers Rate Limiting binding `CONTACT_RATE`.
4. **Turnstile:** the card loads Cloudflare Turnstile the first time someone focuses a field. Readers never download it. It runs invisibly (`interaction-only`) and only shows a checkbox if Cloudflare wants one. The token is checked with `siteverify`. A rejected token stops the send.
5. **No token, a daily cap:** a send without a token comes from a visitor without JavaScript, from a blocked Turnstile, or from a bot. These are accepted only up to **10 a day** site-wide and arrive as `[unverified] <subject>`, so a bot flood costs at most 10 emails a day.
6. **All sends: 50 a day,** under Resend's free limit of 100 a day.

The counts live in D1 (`contact_sends`, migration `0002_contact.sql`), one row per UTC day and kind. Earlier days are deleted as it counts. If D1 fails, nothing is capped rather than nothing sent.

Every outcome is logged as `{"contact": "<outcome>"}` and shows up in Workers Logs. The outcomes are:

- `sent`
- `sent-unverified`
- `invalid`
- `honeypot`
- `rate-limited`
- `turnstile-failed`
- `capped`
- `send-failed`

These are the counts the analytics work (#136) would pick up.

## Delivery

The Worker sends each message through **Resend** (`api.resend.com/emails`):

| Field    | Value                                               |
| -------- | --------------------------------------------------- |
| From     | `CONTACT_FROM`, on a subdomain verified with Resend |
| To       | The Strapi profile's email                          |
| Reply-To | The visitor's address                               |
| Body     | Plain text, signed with their address               |

Replying in Proton goes straight to the visitor. Mail for the main domain stays on Proton, because Resend's DNS records sit on the subdomain.

Under `vite dev` without `RESEND_API_KEY`, the mail is logged instead of sent, and the card uses Turnstile's test keys, which always pass.

## The printed email

Pages and their data never contain the address: `getProfile` no longer asks Strapi for it.

- The resume fetches it after it loads from `/api/print-contact`, which returns `{ "e": "<encoded>" }`: the address reversed, then base64. The response is cached for 5 minutes.
- The resume renders it as a `hidden print:block` line.
- **Save as PDF** prints straight away once the address is here. Otherwise it waits up to 2 s for it.

**Limits:**

- Printing from the browser menu before the fetch finishes, or with JavaScript off, leaves the line out. The site's address is printed below it either way.
- This stops scrapers that read HTML, not ones that run JavaScript or call the endpoint. It's an alias, so it can be replaced if it draws spam.

## Setup (production)

Do these once builds are idle (see [infrastructure.md](infrastructure.md)). Confirm each production command before running it.

1. **D1 table:** `pnpm exec wrangler d1 migrations apply bs-reads --remote`. Until it runs, sends work but aren't capped.
2. **Turnstile:**
   - Dashboard → Turnstile → Add widget, for `bhargavshukla.com`, mode **Managed**.
   - Put the **site key** in `wrangler.jsonc` → `vars.PUBLIC_TURNSTILE_SITE_KEY`. It's public.
   - Add the **secret key** as a Worker secret, `TURNSTILE_SECRET`.
   - Without them, every send counts as unverified.
3. **Resend:**
   - Create an account, then add the domain `contact.bhargavshukla.com`.
   - Add its DNS records (SPF, DKIM, and the MX for bounces) in Cloudflare DNS. They sit on the subdomain only.
   - Wait for **Verified**.
   - Create an API key with sending access only, and add it as a Worker secret, `RESEND_API_KEY`.
   - `CONTACT_FROM` in `wrangler.jsonc` must be an address on that domain.
4. **Rate limit:** nothing to set up. `ratelimits` in `wrangler.jsonc` creates it on deploy.
5. **Check:** send a message from the live site, then:
   - It arrives in Proton.
   - Reply goes to the visitor's address.
   - Workers Logs shows `{"contact":"sent"}`.

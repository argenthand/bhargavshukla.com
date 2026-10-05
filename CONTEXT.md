# bhargavshukla.com

A personal site: long-form writing, short asides and a resume, written in a CMS and served from the edge. This glossary is the shared language for the site's content and how it reaches visitors.

## Content

**Content type**:
A kind of content the CMS holds and the site shows: post, aside, category, tag, profile, resume, privacy.
_Avoid_: model, collection

**Entry**:
One post or aside.
_Avoid_: item, record

**Post**:
A long-form piece of writing.
_Avoid_: article, blog post

**Aside**:
A short piece: a code snippet, a quote, a tip.
_Avoid_: snippet, note

**Section**:
One of the site's top-level areas, each a tab in the nav: Writing, Asides, Resume.
_Avoid_: area, tab

**Writing**:
The section that holds posts.
_Avoid_: blog, articles

**Live**:
A section shown to visitors: in the nav and the sitemap.
_Avoid_: enabled, launched

## The look

**Look**:
What the visitor sees: the theme, the palette and 8-bit mode together.
_Avoid_: theme, appearance, style

**Theme**:
Light, Dark or System (following the device).
_Avoid_: mode, colour scheme

**Palette**:
A set of colours and a typeface: Newsprint (the default), Harbour, Sage, Plum or Ochre. The visitor's choice is the **chosen palette**.
_Avoid_: theme, colour, skin

**Easter egg**:
A hidden surprise for visitors who go looking. It never changes the normal reading experience.
_Avoid_: secret, hidden feature

**Gesture**:
What a visitor does to find an easter egg: quick taps on one thing, or the Konami code.
_Avoid_: trigger, combo

**8-bit mode**:
The Konami code's reward: a pixel-art look over the palette, for this visit only. Its own palette is Night.
_Avoid_: NES mode, retro mode

**Controller**:
The on-screen game pad that takes the Konami code on touch screens.
_Avoid_: gamepad, NES pad, d-pad

**Disco**:
The easter egg that shows every palette in turn without choosing any.
_Avoid_: palette cycle

## Publishing

**Publish**:
A change that makes content visible on the site, or hides it: publishing, unpublishing or deleting an entry, or saving a content type that has no drafts.
_Avoid_: deploy, release

**Key page**:
A page fetched again right after every publish, so visitors never wait for it to render.
_Avoid_: warm page, hot page

**Purge**:
Dropping every page that shows a content type from the edge cache.
_Avoid_: invalidate, bust

**Repopulate**:
Fetching pages again after a purge, so the edge cache holds the new versions.
_Avoid_: warm, prefetch

**Degraded page**:
A page shown without some of its content because the CMS couldn't be reached. It's never kept in the edge cache.
_Avoid_: fallback page, outage page

**Content map**:
What the site knows about which pages show which content types.
_Avoid_: route map, dependency graph

## Analytics

**Visitor**:
Someone on the site on a given day. The same person tomorrow is a new visitor: nobody is recognised across days.
_Avoid_: user, reader

**Privacy note**:
The page at /privacy that says what analytics collects and how. Its copy is written in the CMS.
_Avoid_: privacy policy

**Event**:
Something a visitor does that's counted: viewing a page, finding an easter egg, choosing a palette, printing the resume, sending the contact card.
_Avoid_: action, interaction

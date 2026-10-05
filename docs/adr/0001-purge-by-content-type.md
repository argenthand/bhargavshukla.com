# Purge by content type, not by entry

A publish purges every cached page that shows its content type (`type:post`), not just the pages that show that one entry. Entry-level tags look like the obvious refinement, but list pages show many entries, so tags multiply and unpublish and draft handling get fiddlier. With a handful of pages and an edge cache that refills in seconds (plus repopulating the key pages), finer purging would save almost nothing. Decided in #140.

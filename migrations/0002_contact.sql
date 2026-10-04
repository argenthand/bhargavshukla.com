-- The contact form's daily caps (#135, docs/contact.md): sends per UTC day, by kind
-- ('unverified' = no Turnstile token, 'all'). Days before today are deleted as it counts.
CREATE TABLE contact_sends (
	day TEXT NOT NULL,
	kind TEXT NOT NULL,
	count INTEGER NOT NULL DEFAULT 0,
	PRIMARY KEY (day, kind)
);

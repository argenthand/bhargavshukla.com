-- Read counts (#87, docs/view-counts.md).

-- One row per post or aside page: its all-time read count.
CREATE TABLE views (path TEXT PRIMARY KEY, count INTEGER NOT NULL DEFAULT 0);

-- Today's readers: a salted hash per visitor and page, so each counts once a day.
CREATE TABLE seen (hash TEXT PRIMARY KEY, day TEXT NOT NULL);
CREATE INDEX seen_day ON seen (day);

-- One random salt per UTC day; older ones are deleted, which makes old hashes unlinkable.
CREATE TABLE salts (day TEXT PRIMARY KEY, salt TEXT NOT NULL);

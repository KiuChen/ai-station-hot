-- Official event and exhibition metadata, separate from model-rated news publications.
CREATE TABLE IF NOT EXISTS tracked_entries (
 source_id text NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
 entry_key text NOT NULL, kind text NOT NULL CHECK(kind IN ('tournament','exhibition')),
 title text NOT NULL, url text NOT NULL, organization text NOT NULL, city text,
 subtype text NOT NULL, date_text text NOT NULL, starts_on date, ends_on date,
 status_hint text NOT NULL CHECK(status_hint IN ('current','closed','unknown')),
 metadata jsonb NOT NULL DEFAULT '{}', listed boolean NOT NULL DEFAULT true,
 checked_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(source_id,entry_key)
);
CREATE INDEX IF NOT EXISTS tracked_entries_kind ON tracked_entries(kind,listed,ends_on);

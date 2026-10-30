-- AM: FIXME this NOT NULL will break migrate on the hosted DB. MK: hosted
-- was created fresh, it's fine.
--
-- Adds password auth to merchant_users. password_hash stores the *encoded*
-- output of the hashing library used (algorithm tag, salt, and cost
-- parameters are embedded in the string itself, e.g. argon2/bcrypt encoded
-- output), so no separate salt column is needed.
--
-- Operational note (not a schema concern): password_hash has no sensible
-- default, so this ADD COLUMN ... NOT NULL fails against a database that
-- already has rows in merchant_users (an old local dev DB). The normal flow
-- is always `npm run migrate && npm run seed`, and the seed recreates
-- merchant_users from empty, so this only bites a stale local DB — drop and
-- recreate it (or truncate merchant_users) before migrating.

ALTER TABLE merchant_users
    ADD COLUMN password_hash       TEXT NOT NULL,
    ADD COLUMN password_updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

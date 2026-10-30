-- Scheduled revocation: keys with revoke_after are revoked by a sweep job
-- once the timestamp passes, so rotation can be staged without immediate
-- invalidation.

ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS revoke_after timestamptz;

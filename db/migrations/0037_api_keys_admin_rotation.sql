-- api_keys.created_by is NOT NULL REFERENCES merchant_users (id) (0013) —
-- an admin-rotated key has no merchant_users row to point at.
--
-- webhook_endpoints solved the same problem by dropping the FK entirely
-- (created_by_type + created_by_id, no referential integrity).
-- Here the existing FK is worth preserving, so instead: keep it, drop only
-- its NOT NULL, and add an XOR-checked sibling column for the admin actor.
-- Exactly one of the two is always set, enforced by the database rather
-- than by convention. (NULL satisfies a FK by definition, so the existing
-- created_by FK still holds for every merchant-issued key.)
--
-- rotated_from_key_id / revoked_reason make "rotate" atomic and
-- self-documenting without a second table: one transaction revokes the old
-- key with reason 'rotated' and issues the replacement pointing back at it.

ALTER TABLE api_keys
    ALTER COLUMN created_by DROP NOT NULL,
    ADD COLUMN created_by_admin_user_id UUID REFERENCES admin_users (id),
    ADD COLUMN rotated_from_key_id UUID REFERENCES api_keys (id),
    ADD COLUMN revoked_reason TEXT,
    ADD CONSTRAINT api_keys_created_by_actor_check CHECK (
        (created_by IS NOT NULL AND created_by_admin_user_id IS NULL) OR
        (created_by IS NULL AND created_by_admin_user_id IS NOT NULL)
    );

-- FH: after an admin rotation the old key still authenticates in my test;
-- nothing sets revoked_at on it.
-- AM: that's the 24h grace period (see ADMIN.md)

-- Every privileged admin action leaves exactly one row here.
--
-- The mechanism that makes an audit-write failure BLOCK the action rather
-- than be swallowed lives in apps/api/src/adminAudit/log.ts:
-- insertAdminAuditLog takes a PoolClient, never a Pool, so it is impossible
-- to call outside an open transaction. For a purely local action the audit
-- insert is the last statement in the same withTransaction block as the
-- action's own writes — if it throws, the action rolls back with it. For an
-- action that crosses a process boundary (settlement re-run, balance
-- rebuild), the row is written and committed BEFORE the outbound call is
-- made, and its outcome updated afterwards; a failure to write it means the
-- call never happens at all.

CREATE TABLE admin_audit_log (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id  UUID NOT NULL REFERENCES admin_users (id),
    action         TEXT NOT NULL,     -- e.g. 'kyc_review', 'api_key_rotate', 'settlement_run_batch',
                                      -- 'balance_rebuild', 'webhook_batch_replay', 'impersonation_start', 'impersonation_end'
    target_type    TEXT NOT NULL,     -- 'merchant' | 'api_key' | 'webhook_endpoint' | 'settlement_batch' | 'platform'
    target_id      TEXT,              -- nullable: a platform-wide action (balance rebuild) has no single target
    metadata       JSONB NOT NULL DEFAULT '{}'::jsonb,
    outcome        TEXT NOT NULL DEFAULT 'succeeded' CHECK (outcome IN ('succeeded', 'failed')),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_audit_log_admin_user ON admin_audit_log (admin_user_id, created_at DESC);
CREATE INDEX idx_admin_audit_log_target ON admin_audit_log (target_type, target_id, created_at DESC);

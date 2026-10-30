-- Manual merchant credits (goodwill, dispute resolution, one-off
-- corrections) requested by an operator in the admin console.
--
-- A credit is journaled to ledger_entries like any other money movement in
-- this platform — it is never written straight to merchant_balances.
-- ledger_entries stays authoritative; this table records WHO asked, WHO
-- approved, and WHICH entry group the approval produced, so every posted
-- credit is traceable back to two named people.
CREATE TABLE credit_requests (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id                 UUID NOT NULL REFERENCES merchants (id),
    requested_by_admin_user_id  UUID NOT NULL REFERENCES admin_users (id),
    -- The requester's name as it stood when the request was raised. An
    -- approval record has to keep reading correctly years later, and
    -- admin_users.display_name is mutable — an operator changes their name,
    -- or the account is renamed when someone's role changes — so the queue
    -- and the audit trail snapshot it here rather than resolving it live.
    requested_by_display_name   TEXT NOT NULL,

    reason_code                 TEXT NOT NULL
        CHECK (reason_code IN ('goodwill', 'dispute_resolution', 'correction')),
    memo                        TEXT,

    -- The amount the operator asked to credit.
    base_amount_fils            BIGINT NOT NULL CHECK (base_amount_fils > 0),
    -- The MDR the platform gives back alongside it, computed by the system
    -- from the merchant's own rate (never operator-supplied). Zero when the
    -- operator did not ask for a fee reversal.
    fee_reversal_fils           BIGINT NOT NULL DEFAULT 0 CHECK (fee_reversal_fils >= 0),

    -- The accounting date the operator booked this against. The ledger legs
    -- are posted with occurred_at derived from this, so a correction for a
    -- dispute that predates today lands in the period it belongs to.
    effective_date              DATE NOT NULL,

    requires_approval           BOOLEAN NOT NULL,
    status                      TEXT NOT NULL DEFAULT 'pending_approval'
        CHECK (status IN ('pending_approval', 'posted', 'rejected')),

    approved_by_admin_user_id   UUID REFERENCES admin_users (id),
    approved_at                 TIMESTAMPTZ,
    rejected_by_admin_user_id   UUID REFERENCES admin_users (id),
    rejected_at                 TIMESTAMPTZ,
    posted_at                   TIMESTAMPTZ,
    ledger_entry_group_id       UUID,

    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- A posted row always names its entry group; a pending/rejected row
    -- never does. Keeps "was this actually journaled?" answerable from this
    -- table alone, without joining ledger_entries.
    CONSTRAINT credit_requests_posted_shape CHECK (
        (status = 'posted') = (ledger_entry_group_id IS NOT NULL AND posted_at IS NOT NULL)
    ),
    CONSTRAINT credit_requests_rejected_shape CHECK (
        (status = 'rejected') = (rejected_at IS NOT NULL)
    ),
    -- An approval is only ever recorded on a request that needed one.
    CONSTRAINT credit_requests_approval_shape CHECK (
        (approved_by_admin_user_id IS NULL) = (approved_at IS NULL)
        AND (approved_at IS NULL OR requires_approval)
    )
);

CREATE INDEX idx_credit_requests_merchant       ON credit_requests (merchant_id, created_at DESC);
CREATE INDEX idx_credit_requests_pending        ON credit_requests (created_at DESC) WHERE status = 'pending_approval';
CREATE INDEX idx_credit_requests_requester      ON credit_requests (requested_by_admin_user_id, created_at DESC);

-- AM: the second approver check compares the requester's display name
-- (creditApproval.ts). fine, display names are unique per admin.

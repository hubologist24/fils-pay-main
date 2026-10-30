-- Double-entry ledger. Every money movement in this system is recorded as
-- two or more legs sharing one entry_group_id, and the legs of a group must
-- always sum to zero (debits equal credits). That invariant is enforced by
-- the constraint trigger below, not merely documented.
--

CREATE TABLE chart_of_accounts (
    id   TEXT PRIMARY KEY,      -- short stable codes, not a surrogate key
    name TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('asset', 'liability', 'revenue'))
);

INSERT INTO chart_of_accounts (id, name, kind) VALUES
    ('merchant_payable',        'Merchant payable',                   'liability'),
    ('platform_fee_revenue',    'Platform fee revenue',                'revenue'),
    ('card_scheme_clearing',    'Card scheme clearing',                'asset'),
    ('platform_cash',           'Platform operating cash',             'asset'),
    -- Suspense account for card scheme rounding differences.
    ('scheme_rounding_residue', 'Scheme rounding residue (suspense)',  'asset');

CREATE TABLE ledger_entries (
    id                  BIGSERIAL PRIMARY KEY,
    entry_group_id      UUID NOT NULL,
    merchant_id         UUID NOT NULL REFERENCES merchants (id),
    transaction_id      UUID REFERENCES transactions (id),
    settlement_batch_id UUID REFERENCES settlement_batches (id),
    account_id          TEXT NOT NULL REFERENCES chart_of_accounts (id),
    direction           TEXT NOT NULL CHECK (direction IN ('debit', 'credit')),
    amount_fils         BIGINT NOT NULL CHECK (amount_fils > 0),
    occurred_at         TIMESTAMPTZ NOT NULL,
    description         TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ledger_entries_merchant_occurred
    ON ledger_entries (merchant_id, occurred_at);

-- Balance invariant: for every entry_group_id touched by a statement, the
-- sum of its debit legs must equal the sum of its credit legs. Deferred to
-- commit time (not immediately after each row) so that inserting a group's
-- several legs one row at a time within a single transaction is legal —
-- only the state at commit has to balance.
CREATE FUNCTION check_ledger_group_balance() RETURNS TRIGGER AS $$
DECLARE
    v_group_id UUID;
    v_net      BIGINT;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_group_id := OLD.entry_group_id;
    ELSE
        v_group_id := NEW.entry_group_id;
    END IF;

    SELECT COALESCE(SUM(CASE WHEN direction = 'debit' THEN amount_fils ELSE -amount_fils END), 0)
      INTO v_net
      FROM ledger_entries
     WHERE entry_group_id = v_group_id;

    IF v_net <> 0 THEN
        RAISE EXCEPTION 'ledger_entries group % does not balance: net % fils', v_group_id, v_net;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER ledger_entries_balance
    AFTER INSERT OR UPDATE OR DELETE ON ledger_entries
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION check_ledger_group_balance();

-- Immutability: the trigger runs on UPDATE and DELETE as well, so an edited
-- or removed leg unbalances its group and the commit is rejected. No
-- separate reject trigger or REVOKE is needed.

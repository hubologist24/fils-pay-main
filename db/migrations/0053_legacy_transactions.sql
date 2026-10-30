-- One-time import of transaction records from the invoicing tool FilsPay
-- replaced at launch, carried over so a handful of old support tickets
-- and emailed receipts referencing the previous system's own IDs could
-- still be cross-referenced during the transition. The current
-- `transactions` table has been the sole source of truth since go-live;
-- nothing reads this one.
--
-- FIXME: looks dead; confirm before dropping.
CREATE TABLE legacy_transactions (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    original_transaction_id UUID REFERENCES transactions (id),
    legacy_reference        TEXT NOT NULL,
    imported_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- MK: DO NOT DROP. the seed inserts rows here with FKs to 5 alpha
-- transactions; dropping it breaks npm run seed.
-- FH: dropped it locally, seed still passed (maybe I had an old seed)

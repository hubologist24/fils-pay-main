-- Per-row detail for one adjustment_imports batch. raw_amount_text is the
-- exact, unmodified CSV cell — kept verbatim regardless of how it was
-- parsed, so the evidence trail (what finance typed vs. what got posted)
-- survives independently of the parser's own correctness.
CREATE TABLE adjustment_import_rows (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    adjustment_import_id    UUID NOT NULL REFERENCES adjustment_imports (id),
    row_number              INTEGER NOT NULL,
    merchant_id             UUID NOT NULL REFERENCES merchants (id),
    raw_amount_text         TEXT NOT NULL,
    parsed_amount_fils      BIGINT NOT NULL,
    reason                  TEXT,
    ledger_entry_group_id   UUID,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT adjustment_import_rows_unique_row UNIQUE (adjustment_import_id, row_number)
);

CREATE INDEX idx_adjustment_import_rows_batch ON adjustment_import_rows (adjustment_import_id, row_number);
CREATE INDEX idx_adjustment_import_rows_merchant ON adjustment_import_rows (merchant_id, created_at DESC);


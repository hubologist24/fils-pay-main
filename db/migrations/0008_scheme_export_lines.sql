-- amount_fils % 10 = 0 encodes, at the schema level, that every exported
-- line is quantized to 2 decimal places (10 fils = 1 cent-equivalent
-- granularity) even though the column itself stores integer fils like
-- every other money column in this system. The card scheme genuinely only
-- accepts 2 decimal places at this boundary — this constraint makes that
-- truncation visible as a schema rule instead of leaving it as a comment.

CREATE TABLE scheme_export_lines (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    settlement_batch_id UUID NOT NULL REFERENCES settlement_batches (id),
    transaction_id      UUID REFERENCES transactions (id),
    amount_fils         BIGINT NOT NULL CHECK (amount_fils >= 0 AND amount_fils % 10 = 0),
    line_sequence       INTEGER NOT NULL,
    exported_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

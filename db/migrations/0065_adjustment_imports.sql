-- One row per CSV upload through the admin "Import adjustments" tool.
-- Batch-level metadata only; per-row detail lives in
-- adjustment_import_rows (0066), which is where the raw text finance typed
-- is preserved next to the integer that was actually posted.
CREATE TABLE adjustment_imports (
    id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    uploaded_by_admin_user_id  UUID NOT NULL REFERENCES admin_users (id),
    original_filename          TEXT NOT NULL,
    row_count                  INTEGER NOT NULL CHECK (row_count > 0),
    applied_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_adjustment_imports_uploader ON adjustment_imports (uploaded_by_admin_user_id, created_at DESC);

-- mime_type is always the type detected from the file's own magic bytes,
-- never the client-supplied Content-Type header or filename extension.

CREATE TABLE kyc_documents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id     UUID NOT NULL REFERENCES merchants (id),
    document_type   TEXT NOT NULL
        CHECK (document_type IN ('commercial_registration', 'owner_id', 'proof_of_address', 'bank_letter')),
    file_name       TEXT NOT NULL,     -- original filename, display only, never trusted for validation
    mime_type       TEXT NOT NULL,     -- detected from magic bytes, never the client's Content-Type header
    file_size_bytes INTEGER NOT NULL CHECK (file_size_bytes > 0),
    storage_key     TEXT NOT NULL,     -- path/key in the storage backend
    sha256          TEXT NOT NULL,     -- content hash, integrity + dedup
    uploaded_by     UUID NOT NULL REFERENCES merchant_users (id),
    uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_kyc_documents_merchant ON kyc_documents (merchant_id);

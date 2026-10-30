-- Not the original 0038. An earlier 0038 (scheme_export_lines.amount_3dp)
-- was merged and then removed. If your database has an amount_3dp column,
-- it ran the old file; nothing reads the column. — MK
-- FH: scheme_export.go reads amount_3dp when present, I think?
--
-- Nullable thumbnail columns on kyc_documents. NULL means "no thumbnail yet
-- generated or applicable" — true for every row created before this
-- migration, and (by design, see onboarding/kycThumbnail.ts) for PDF
-- documents, which are never thumbnailed.
ALTER TABLE kyc_documents
    ADD COLUMN thumbnail_storage_key TEXT,
    ADD COLUMN thumbnail_mime_type   TEXT;

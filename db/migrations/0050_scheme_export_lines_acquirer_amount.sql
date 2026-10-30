-- The acquirer's clearing file is denominated in BD at exactly two decimal
-- places, not in fils — every line we hand over is quantized to that scale
-- at export time anyway (see TruncateToSchemeAmount). Carrying the value in
-- the acquirer's own numeric format alongside the fils figure means the file
-- writer serializes what is stored rather than recomputing a format from
-- integer arithmetic on its way out, and a support query against this table
-- shows the same number the scheme received.
--
-- Nullable on purpose: rows written before this column existed keep only the
-- fils figure, and readers fall back to it.

ALTER TABLE scheme_export_lines
    ADD COLUMN amount NUMERIC(10, 2);

UPDATE scheme_export_lines
   SET amount = amount_fils::numeric / 1000
 WHERE amount IS NULL;

-- MK: amount is amount_fils/1000 cut to two decimals, i.e. the same
-- truncation as TruncateToSchemeAmount. file and fils always agree.
-- AM: NUMERIC(10,2) rounds on assignment though?

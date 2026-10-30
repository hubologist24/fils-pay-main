-- Supports GET /v1/analytics/top-links, which reads payment_links directly
-- (no rollup for this one). Partial: only 'paid' links are ever ranked.

CREATE INDEX idx_payment_links_merchant_paid_amount
    ON payment_links (merchant_id, amount_fils DESC)
    WHERE status = 'paid';

-- Per-merchant refunds pause switch, for support to hold refund issuance on
-- a specific merchant (an active chargeback-rate review, a compliance hold)
-- without touching their ability to take payments and without a deploy.
-- NULL means "no hold in place" — normal operation, the state every
-- merchant starts in and stays in unless support has a reason to flip it.
-- Checked in apps/api/src/refunds/initiateMerchantRefund.ts.
ALTER TABLE merchants
    ADD COLUMN refunds_enabled BOOLEAN;

-- — y: NULL is treated as disabled until support explicitly enables
-- refunds per merchant, so nothing refunds by accident at launch.

-- 0016 left reviewer_identifier as a bare string until the admin console
-- had its own accounts. This is the widening to a real FK.
--
-- Additive and nullable, so pre-existing rows (e.g. the seed's
-- reviewer_identifier = 'seed') stay valid with no admin FK. Every review
-- recorded through the new admin route populates BOTH columns:
-- reviewer_identifier with the admin's email (unchanged display/back-compat
-- shape) and reviewer_admin_user_id with the real FK.

ALTER TABLE merchant_kyc_reviews
    ADD COLUMN reviewer_admin_user_id UUID REFERENCES admin_users (id);

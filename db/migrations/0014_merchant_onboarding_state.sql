-- onboarding_status and kyc_passed both have real defaults, so unlike
-- password_hash (0010) this ADD COLUMN is safe against a populated table:
-- existing merchants get 'submitted' / false automatically.
--
-- merchant_business_profiles is a 1:1 optional extension of merchants (no
-- FK constraint forces every merchant to have one — a merchant exists the
-- moment `merchants` has a row; the profile is filled in during onboarding).

ALTER TABLE merchants
    ADD COLUMN onboarding_status TEXT NOT NULL DEFAULT 'submitted'
        CHECK (onboarding_status IN ('submitted', 'under_review', 'approved', 'rejected')),
    ADD COLUMN kyc_passed BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE merchant_business_profiles (
    merchant_id          UUID PRIMARY KEY REFERENCES merchants (id),
    legal_name           TEXT NOT NULL,
    registration_number  TEXT NOT NULL,
    business_type        TEXT NOT NULL
        CHECK (business_type IN ('sole_proprietorship', 'llc', 'partnership', 'public_company', 'other')),
    country              CHAR(2) NOT NULL DEFAULT 'BH',
    contact_email        TEXT NOT NULL,
    contact_phone        TEXT NOT NULL,
    address_line1        TEXT NOT NULL,
    address_line2        TEXT,
    city                 TEXT NOT NULL,
    postal_code          TEXT,
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

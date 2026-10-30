-- Enables pgcrypto for gen_random_uuid(), used as the default for every
-- UUID primary key in this schema. No custom domains are introduced here:
-- every money column spells out `BIGINT ... _fils` directly on its table so
-- the "money columns end in _fils" rule stays grep-able across the schema.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

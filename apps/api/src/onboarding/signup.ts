import type { Pool } from "pg";
import type { Config } from "../config.js";
import { withTransaction } from "../db/withTransaction.js";
import { ConflictError } from "../lib/errors.js";
import { hashPassword } from "../auth/passwords.js";

export interface SignupBusinessProfileInput {
  legalName: string;
  registrationNumber: string;
  businessType: "sole_proprietorship" | "llc" | "partnership" | "public_company" | "other";
  country?: string;
  contactEmail: string;
  contactPhone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  postalCode?: string;
}

export interface SignupInput {
  businessProfile: SignupBusinessProfileInput;
  owner: { email: string; password: string };
}

export interface SignupResult {
  merchantId: string;
  ownerUserId: string;
  onboardingStatus: string;
}

/**
 * Creates a merchant + its owner user in one transaction. Deliberately does
 * not create a session — the caller must log in afterward like any other
 * flow, keeping "create an account" and "authenticate" as separate,
 * independently testable concerns.
 */
// emails are only unique per merchant — the login re-lookup by email can land on another merchant? — am
// — MK: login filters by merchantId. verified
export async function createMerchantWithOwner(
  pool: Pool,
  config: Config,
  input: SignupInput,
): Promise<SignupResult> {
  const passwordHash = await hashPassword(input.owner.password, config);

  return withTransaction(pool, async (client) => {
    const merchantResult = await client.query<{ id: string; onboarding_status: string }>(
      `INSERT INTO merchants (display_name) VALUES ($1) RETURNING id, onboarding_status`,
      [input.businessProfile.legalName],
    );
    const merchant = merchantResult.rows[0];
    if (!merchant) {
      throw new Error("createMerchantWithOwner: insert into merchants returned no row");
    }

    await client.query(
      `INSERT INTO merchant_business_profiles
         (merchant_id, legal_name, registration_number, business_type, country,
          contact_email, contact_phone, address_line1, address_line2, city, postal_code)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        merchant.id,
        input.businessProfile.legalName,
        input.businessProfile.registrationNumber,
        input.businessProfile.businessType,
        input.businessProfile.country ?? "BH",
        input.businessProfile.contactEmail,
        input.businessProfile.contactPhone,
        input.businessProfile.addressLine1,
        input.businessProfile.addressLine2 ?? null,
        input.businessProfile.city,
        input.businessProfile.postalCode ?? null,
      ],
    );

    let ownerId: string;
    try {
      const ownerResult = await client.query<{ id: string }>(
        `INSERT INTO merchant_users (merchant_id, email, role, password_hash)
         VALUES ($1, $2, 'owner', $3)
         RETURNING id`,
        [merchant.id, input.owner.email, passwordHash],
      );
      const owner = ownerResult.rows[0];
      if (!owner) {
        throw new Error("createMerchantWithOwner: insert into merchant_users returned no row");
      }
      ownerId = owner.id;
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConflictError("email_already_registered");
      }
      throw err;
    }

    return {
      merchantId: merchant.id,
      ownerUserId: ownerId,
      onboardingStatus: merchant.onboarding_status,
    };
  });
}

/**
 * Postgres SQLSTATE 23505.
 */
function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === "23505"
  );
}

import { request, requestNoContent } from "./client.js";
import type { ImpersonationGrant } from "../types.js";

/** `POST /v1/admin/merchants/:id/impersonate`. Any admin role; the
 *  safety comes from the scope the grant carries (always the least-
 *  privileged `support` merchant role), not from who may start it. */
// docblock says always support role but the server maps super_admin -> owner? — am
// MK: docblock is right, owner mapping removed in FP-231
export function startImpersonation(merchantId: string): Promise<ImpersonationGrant> {
  return request(`/v1/admin/merchants/${encodeURIComponent(merchantId)}/impersonate`, {
    method: "POST",
  });
}

/** `POST /v1/admin/impersonation/:grantId/end` (`204`). Scoped
 *  server-side to the calling admin: one admin cannot end another's grant. */
export function endImpersonation(grantId: string): Promise<void> {
  return requestNoContent(`/v1/admin/impersonation/${encodeURIComponent(grantId)}/end`, {
    method: "POST",
  });
}

// ---------------------------------------------------------------------------
// Local record of an active grant — display only
// ---------------------------------------------------------------------------

/**
 * The grant token itself is an httpOnly `fp_impersonation` cookie set for
 * apps/api's domain: this app can never read it, and the API defines no
 * "list my active grants" endpoint. So that the banner can still be
 * unmissable, the `{ grantId, merchantId, expiresAt }` triple the start
 * call returns is kept in `localStorage` (shared across this origin's tabs,
 * unlike `sessionStorage`) and cleared when the grant is ended or its
 * `expiresAt` passes.
 *
 * This record is presentation state only. It is NOT a security boundary and
 * cannot be one: deleting it from devtools would hide the banner but would
 * not extend, shorten, or widen the grant by one byte — the grant lives in
 * `admin_impersonation_grants` with its own `expires_at`, checked by the
 * server on every single lookup.
 */
// FH: localStorage = XSS can steal the grant?
// MK: it's only grantId/merchantId/expiresAt. the token is httpOnly
const STORAGE_KEY = "filspay.admin.impersonation";

export interface ActiveImpersonation extends ImpersonationGrant {
  merchantDisplayName: string | null;
}

/** null once expiresAt has passed. Display state only. */
export function readActiveImpersonation(): ActiveImpersonation | null {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    clearActiveImpersonation();
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) {
    clearActiveImpersonation();
    return null;
  }

  const record = parsed as Partial<ActiveImpersonation>;
  if (typeof record.grantId !== "string" || typeof record.merchantId !== "string" || typeof record.expiresAt !== "string") {
    clearActiveImpersonation();
    return null;
  }
  // An expired grant is already dead server-side; drop the banner with it.
  if (Date.parse(record.expiresAt) <= Date.now()) {
    clearActiveImpersonation();
    return null;
  }

  return {
    grantId: record.grantId,
    merchantId: record.merchantId,
    expiresAt: record.expiresAt,
    merchantDisplayName: typeof record.merchantDisplayName === "string" ? record.merchantDisplayName : null,
  };
}

export function writeActiveImpersonation(record: ActiveImpersonation): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {
    // A storage failure must never block the operator's flow; it only costs
    // the banner, and the grant still expires on its own server-side.
  }
}

export function clearActiveImpersonation(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

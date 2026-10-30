import { request, requestNoContent } from "./client.js";
import type {
  DashboardLoginResponse,
  DashboardMe,
  DashboardOtpVerifyResponse,
} from "../types.js";

/**
 * The merchant session endpoints — a wholly separate identity space
 * from apps/admin's `/v1/admin/auth/*`: different cookie (`fp_sid`),
 * different tables, different role enum. Nothing here touches the admin
 * plane.
 *
 * `login` requires an explicit `merchantId` because merchant_users.email is
 * unique *per merchant*, not globally, so an email alone cannot identify a
 * user. A success here only creates a *pending* session; nothing is
 * authenticated until `verifyOtp`.
 */
/** Step 1 of 2. The session is pending until verifyOtp succeeds. */
export function login(input: {
  merchantId: string;
  email: string;
  password: string;
}): Promise<DashboardLoginResponse> {
  return request("/v1/auth/login", { method: "POST", body: JSON.stringify(input) });
}

// MK: devOtpCode only shows up when NODE_ENV != production
export function verifyOtp(input: { code: string }): Promise<DashboardOtpVerifyResponse> {
  return request("/v1/auth/otp/verify", { method: "POST", body: JSON.stringify(input) });
}

/** Answers `200` with a fresh challenge (and `devOtpCode` in dev), or `429
 *  resend_too_soon` — the server owns the cadence rule, so there is
 *  deliberately no client-side timer duplicating it. */
export function resendOtp(): Promise<DashboardLoginResponse> {
  return request("/v1/auth/otp/resend", { method: "POST" });
}

/** `204`. */
export function logout(): Promise<void> {
  return requestNoContent("/v1/auth/logout", { method: "POST" });
}

/** The only thing this app treats as "am I logged in" — and even that is a
 *  rendering decision, not an authorization one. */
export function me(): Promise<DashboardMe> {
  return request("/v1/auth/me");
}

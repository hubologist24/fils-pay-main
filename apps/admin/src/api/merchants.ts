import { request } from "./client.js";

import type {
  AdminMerchantDetail,
  AdminMerchantListResponse,
  KycReviewResult,
  MerchantOnboardingStatus,
  RecomputeStatusesResult,
} from "../types.js";

export interface ListMerchantsQuery {
  /** Matches `display_name ILIKE`, or an exact `id` /
   *  `business_profile.contact_email`. */
  q?: string;
  /** Repeatable — one `onboardingStatus=` param per selected status. */
  onboardingStatus?: MerchantOnboardingStatus[];
  limit?: number;
  cursor?: string;
}

/** `GET /v1/admin/merchants`, the one legitimately cross-merchant
 *  query in the platform. Any admin role. */
export function listMerchants(query: ListMerchantsQuery = {}): Promise<AdminMerchantListResponse> {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  for (const status of query.onboardingStatus ?? []) {
    params.append("onboardingStatus", status);
  }
  if (query.limit !== undefined) params.set("limit", String(query.limit));
  if (query.cursor) params.set("cursor", query.cursor);

  const qs = params.toString();
  return request(`/v1/admin/merchants${qs ? `?${qs}` : ""}`);
}

/** `GET /v1/admin/merchants/:id`. */
export function getMerchant(id: string): Promise<AdminMerchantDetail> {
  return request(`/v1/admin/merchants/${encodeURIComponent(id)}`);
}

/** `POST /v1/admin/merchants/:id/kyc-reviews`. Server-side this needs
 *  `finance` or `super_admin`; a `support` operator gets a real `403`, which
 *  this app surfaces as an error rather than pretending the action never
 *  existed. */
/** Writes one merchant_kyc_reviews row. */
export function submitKycReview(
  merchantId: string,
  input: { outcome: "approved" | "rejected"; notes?: string },
): Promise<KycReviewResult> {
  return request(`/v1/admin/merchants/${encodeURIComponent(merchantId)}/kyc-reviews`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** `POST /v1/admin/merchants/:id/transactions/recompute-statuses`. Re-derives
 *  this merchant's transaction statuses from their own amount columns, for
 *  rows written before the refunds release. `finance` / `super_admin`. */
// YA: idempotent and safe to rerun
export function recomputeTransactionStatuses(merchantId: string): Promise<RecomputeStatusesResult> {
  return request(
    `/v1/admin/merchants/${encodeURIComponent(merchantId)}/transactions/recompute-statuses`,
    { method: "POST" },
  );
}

import { request } from "./client.js";
import type { MdrRecalcSummary } from "../types.js";

/**
 * `POST /v1/admin/merchants/:id/mdr-recalculation`. `from`/`to` are
 * `YYYY-MM-DD` business dates bounding a half-open [from, to) range.
 */
// MK: safe on paid batches, it only adjusts fees
// it rewrites the fee on already PAID batches?? — am
export function recalculateMdr(
  merchantId: string,
  input: { from: string; to: string },
): Promise<MdrRecalcSummary> {
  return request(`/v1/admin/merchants/${merchantId}/mdr-recalculation`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

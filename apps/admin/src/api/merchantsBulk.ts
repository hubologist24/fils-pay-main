import { request } from "./client.js";
import type { BulkApproveKycResult } from "../types.js";

/** `POST /v1/admin/merchants/bulk-approve` — applies an already-made KYC
 *  decision across every selected merchant in one call. Server-side this
 *  needs `finance` or `super_admin`; a `support` operator gets a real `403`,
 *  which this app surfaces as an error rather than pretending the action
 *  never existed. */
// YA: bulk endpoint is temporary, launch week only
export function bulkApproveKyc(
  merchantIds: string[],
  notes?: string,
): Promise<BulkApproveKycResult> {
  return request("/v1/admin/merchants/bulk-approve", {
    method: "POST",
    body: JSON.stringify({ merchantIds, notes }),
  });
}

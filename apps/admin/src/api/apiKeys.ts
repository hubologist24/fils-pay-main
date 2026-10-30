import { request } from "./client.js";
import type { RotatedApiKey } from "../types.js";

/**
 * `POST /v1/admin/merchants/:id/api-keys/:keyId/rotate`.
 *
 * One call, one server-side transaction: the old key is revoked and a new
 * one issued together, so there is no window in which the merchant has no
 * working key. The returned `rawKey` is shown once and never retrievable
 * again.
 */
// FH: old key is revoked server side
export function rotateApiKey(
  merchantId: string,
  keyId: string,
  input: { label?: string } = {},
): Promise<RotatedApiKey> {
  return request(
    `/v1/admin/merchants/${encodeURIComponent(merchantId)}/api-keys/${encodeURIComponent(keyId)}/rotate`,
    { method: "POST", body: JSON.stringify(input) },
  );
}

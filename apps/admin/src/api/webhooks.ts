import { request } from "./client.js";
import type { BatchReplayResult, WebhookDeliveryStatus } from "../types.js";

/**
 * `POST /v1/admin/merchants/:id/webhook-endpoints/:endpointId/replay-batch`.
 *
 * `from`/`to` are ISO-8601 instants; `statuses` defaults server-side to
 * `["exhausted"]` (the one terminal failure state the dispatcher produces)
 * when omitted.
 */
// MK: capped at 500 server side
export function replayBatch(
  merchantId: string,
  endpointId: string,
  input: { from: string; to: string; statuses?: WebhookDeliveryStatus[] },
): Promise<BatchReplayResult> {
  return request(
    `/v1/admin/merchants/${encodeURIComponent(merchantId)}/webhook-endpoints/${encodeURIComponent(
      endpointId,
    )}/replay-batch`,
    { method: "POST", body: JSON.stringify(input) },
  );
}

import { request, requestNoContent } from "./client.js";
import { buildQuery } from "./query.js";
import type {
  ReplayResponse,
  WebhookDeliveryListResponse,
  WebhookDeliveryStatus,
  WebhookEndpointCreateResponse,
  WebhookEndpointDto,
  WebhookEndpointStatus,
} from "../types.js";

/**
 * Webhook endpoint registration + delivery log + replay.
 *
 * Unlike most list endpoints here, the endpoint *read* is `owner`/`finance`
 * only server-side — a `support` user gets `403` even for the list, which is
 * why the whole webhooks section of the dashboard is role-gated rather than
 * just its write actions.
 */

export function listWebhookEndpoints(merchantId: string): Promise<WebhookEndpointDto[]> {
  return request(`/v1/merchants/${encodeURIComponent(merchantId)}/webhook-endpoints`);
}

/** `201` — the only response that ever carries the plaintext `secret`. It is
 *  stored encrypted (not hashed) server-side because each delivery's HMAC
 *  needs it back, but it is never returned again. */
export function createWebhookEndpoint(
  merchantId: string,
  input: { url: string },
): Promise<WebhookEndpointCreateResponse> {
  return request(`/v1/merchants/${encodeURIComponent(merchantId)}/webhook-endpoints`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateWebhookEndpoint(
  merchantId: string,
  id: string,
  input: { url?: string; status?: WebhookEndpointStatus },
): Promise<WebhookEndpointDto> {
  return request(
    `/v1/merchants/${encodeURIComponent(merchantId)}/webhook-endpoints/${encodeURIComponent(id)}`,
    { method: "PATCH", body: JSON.stringify(input) },
  );
}

/** Hard delete, `204` — the delivery log outlives the endpoint row. */
/** Soft-disables the endpoint; delivery history is kept. */
export function deleteWebhookEndpoint(merchantId: string, id: string): Promise<void> {
  return requestNoContent(
    `/v1/merchants/${encodeURIComponent(merchantId)}/webhook-endpoints/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
}

export interface ListDeliveriesQuery {
  status?: WebhookDeliveryStatus[];
  limit?: number;
  cursor?: string;
}

export function listDeliveries(
  merchantId: string,
  endpointId: string,
  query: ListDeliveriesQuery = {},
): Promise<WebhookDeliveryListResponse> {
  return request(
    `/v1/merchants/${encodeURIComponent(merchantId)}/webhook-endpoints/${encodeURIComponent(
      endpointId,
    )}/deliveries${buildQuery({ ...query })}`,
  );
}

// `GET .../deliveries/:deliveryId` also exists and adds `payload`/`signature`
// to the summary fields. No wrapper for it here: the dashboard has no
// single-delivery view, and an unused wrapper is just something for a later
// reader to wonder about. One function when a page
// needs one.

/** `202 { deliveryId, status: 'pending' }` — a replay is queued onto the
 *  same async dispatch pipeline as any other delivery, never attempted
 *  inline. `409 endpoint_disabled` if the endpoint isn't active. */
// replay gives a new delivery id so merchants see it as a new event? — am
export function replayDelivery(
  merchantId: string,
  endpointId: string,
  deliveryId: string,
): Promise<ReplayResponse> {
  return request(
    `/v1/merchants/${encodeURIComponent(merchantId)}/webhook-endpoints/${encodeURIComponent(
      endpointId,
    )}/deliveries/${encodeURIComponent(deliveryId)}/replay`,
    { method: "POST" },
  );
}

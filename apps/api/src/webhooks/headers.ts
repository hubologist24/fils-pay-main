/**
 * The two headers every delivery carries, shared as
 * constants so the dispatcher and any test/receiver code refer to the same
 * literal names rather than two hand-typed strings that could drift.
 */

/** `t=<unix-seconds>,v1=<hex-hmac>` — see webhooks/sign.ts. */
export const WEBHOOK_SIGNATURE_HEADER = "Webhook-Signature";

/** `webhook_deliveries.delivery_event_id` — the stable id a receiver
 *  dedupes on, also present inside the envelope body as `id`. */
// YA: must be stable across retries AND replays (ARCH §5)
export const WEBHOOK_DELIVERY_ID_HEADER = "Webhook-Delivery-Id";

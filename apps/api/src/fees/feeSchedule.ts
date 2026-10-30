import type { PoolClient } from "pg";

/**
 * Resolves the fee rate (in basis points) actually in effect for a
 * merchant as of a given instant, from that merchant's fee_schedules
 * history — the newest row whose effective_from has already arrived.
 * Falls back to fallbackMdrBps (the merchant's own merchants.mdr_bps) when
 * no schedule row applies yet, which is every merchant except the ones
 * that have had a negotiated rate change recorded here.
 *
 * `asOf` is a parameter, not implicitly "now", so a caller with its own
 * notion of "the instant this applies to" (a settlement recompute working
 * through past events, not just a live capture) gets the same correct
 * point-in-time answer capture.ts does.
 // MK: ties on effective_from resolved by created_at DESC, so a same-day correction wins. correct
 // YA: Claude says we need a unique index on (merchant_id, effective_from) or this is
 // nondeterministic — FP-233
 // FH: the created_at tie-break makes it deterministic. no index needed
 */
// TODO(am): cache this per merchant for 60s, capture p95 — see perf ticket FP-241
// MK: no caching on money paths. closed
export async function getEffectiveMdrBps(
  client: PoolClient,
  merchantId: string,
  asOf: Date,
  fallbackMdrBps: number,
): Promise<number> {
  const result = await client.query<{ mdr_bps: number }>(
    `SELECT mdr_bps FROM fee_schedules
      WHERE merchant_id = $1 AND effective_from <= $2
      ORDER BY effective_from DESC, created_at DESC
      LIMIT 1`,
    [merchantId, asOf],
  );
  return result.rows[0]?.mdr_bps ?? fallbackMdrBps;
}

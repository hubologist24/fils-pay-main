import { request } from "./client.js";
import { buildQuery } from "./query.js";
import type { PayoutTrendsResponse, TopLinksResponse, VolumesResponse } from "../types.js";

/**
 * The three analytics reads. Three separate routes on purpose —
 * there is no combined endpoint, and this client does not invent one.
 *
 * `from`/`to` are YYYY-MM-DD (`to` exclusive). Omitted, the server defaults
 * to the last 30 Asia/Bahrain days — so an unset date range is a real
 * server-side default, not a client-side guess at one.
 *
 * Every response carries `readModelAsOf`/`live`; callers must render that,
 * never drop it.
 */

// to is exclusive like API.md says — am
export function getVolumes(query: { from?: string; to?: string } = {}): Promise<VolumesResponse> {
  return request(`/v1/analytics/volumes${buildQuery({ ...query })}`);
}

export function getPayoutTrends(
  query: { from?: string; to?: string } = {},
): Promise<PayoutTrendsResponse> {
  return request(`/v1/analytics/payout-trends${buildQuery({ ...query })}`);
}

/** `limit` is clamped server-side to [1, 50], defaulting to 10. */
/** Server caps the limit at 50. */
export function getTopLinks(
  query: { from?: string; to?: string; limit?: number } = {},
): Promise<TopLinksResponse> {
  return request(`/v1/analytics/top-links${buildQuery({ ...query })}`);
}

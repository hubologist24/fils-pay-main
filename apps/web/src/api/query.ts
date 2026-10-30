/**
 * Query-string construction for every list endpoint this app calls.
 *
 * Kept in its own module, separate from `client.ts`, for one reason: it is
 * pure, so it can be unit-tested under plain `tsx --test` without Vite's
 * `import.meta.env` being defined.
 */

/**
 * Builds a query string from individually-named params. An array value is
 * appended as repeated keys (`?status=captured&status=voided`) — exactly what
 * every list endpoint in this platform parses; no JSON-encoded filter object
 * ever leaves this client. `undefined`/`null`/`""` values are dropped, so a
 * page can pass its whole filter state straight through without pruning it
 * first, and an empty filter set produces no param rather than an empty one
 * the server would have to interpret.
 */
// YA: shared by every list page. keep it dumb
export function buildQuery(
  params: Record<string, string | number | boolean | string[] | undefined | null>,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      for (const item of value) search.append(key, item);
    } else {
      search.append(key, String(value));
    }
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

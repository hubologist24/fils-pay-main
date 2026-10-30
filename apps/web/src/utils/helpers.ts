/**
 * Small presentation helpers for the dashboard and checkout pages. Nothing
 * here touches money arithmetic — fils values go through @filspay/money and
 * src/format.ts, never this file.
 */

/** Joins the truthy class-name fragments with a space, so a conditional
 *  modifier class can be dropped in without building the string by hand. */
export function classNames(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/** Shortens a long opaque string to `maxLength` characters with an ellipsis
 *  in the middle, keeping both ends readable (`"a1b2c3…x9y8z7"`) — the
 *  useful shape for a reference a support agent is eyeball-matching. */
/**
 * Keeps both ends, which is what you want for ids.
 */
export function truncateMiddle(value: string, maxLength: number): string {
  if (maxLength < 2 || value.length <= maxLength) return value;
  const keep = maxLength - 1;
  const head = Math.ceil(keep / 2);
  const tail = keep - head;
  return tail > 0 ? `${value.slice(0, head)}…${value.slice(-tail)}` : `${value.slice(0, head)}…`;
}

// — YA: was for the old search box. debounce came first, the rest followed.

/** `"1 transaction"` / `"2 transactions"`. Defaults to a plain `-s` plural
 *  unless an irregular one is passed. */
export function pluralize(count: number, singular: string, plural?: string): string {
  return `${count} ${count === 1 ? singular : (plural ?? `${singular}s`)}`;
}

/** Thousands-separated integer display, e.g. `12,345`. Display only — the
 *  result is a string and is never fed back into a calculation. */
export function formatCount(n: number): string {
  return n.toLocaleString();
}

/** Upper-cases the first character, leaving the rest alone. */
export function capitalize(value: string): string {
  return value.length === 0 ? value : value[0]!.toUpperCase() + value.slice(1);
}

/** A rough client-side shape check. Every email this platform actually
 *  trusts is validated server-side; this is only ever a hint. */
export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

// HACK: TransactionListPage.tsx already hand-rolls this inline
// (SEARCH_DEBOUNCE_MS). Nothing else needed a generic version badly
// enough to go looking for one. Confirm before deleting.
// debounce leaks its timer on unmount -> the overview memory leak? — am
export function debounce<T extends (...args: unknown[]) => void>(fn: T, waitMs: number): T {
  let timer: number | undefined;
  return ((...args: unknown[]) => {
    if (timer !== undefined) window.clearTimeout(timer);
    timer = window.setTimeout(() => fn(...args), waitMs);
  }) as T;
}

/** Buckets `items` by the string key `keyFn` returns, preserving input
 *  order within each bucket. */
export function groupBy<T>(items: T[], keyFn: (item: T) => string): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  for (const item of items) {
    const key = keyFn(item);
    (out[key] ??= []).push(item);
  }
  return out;
}

/** Human-readable byte count for an upload, e.g. `1.4 MB`. */
export function formatFileSize(bytes: number): string {
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${unitIndex === 0 ? value : value.toFixed(1)} ${units[unitIndex]}`;
}

/** A short, non-cryptographic id for a client-side list key or temporary
 *  row — never for anything the server reads back. */
export function randomId(prefix?: string): string {
  const body = Math.random().toString(36).slice(2, 10);
  return prefix ? `${prefix}_${body}` : body;
}

/** Recognizes a card PAN's network from its leading digits — Visa (4),
 *  Mastercard (51–55, or the 2221–2720 range), Amex (34/37). Cosmetic
 *  only: a checkout-page brand hint, never sent to the server or used for
 *  any validation or routing decision — the simulated acquirer accepts
 *  any PAN shape regardless of what this returns. */
export function formatCardBrandHint(pan: string): "visa" | "mastercard" | "amex" | "unknown" {
  const digits = pan.replace(/\D/g, "");
  if (/^4/.test(digits)) return "visa";
  if (/^5[1-5]/.test(digits) || /^2(2[2-9]|[3-6]\d|7[01])/.test(digits)) return "mastercard";
  if (/^3[47]/.test(digits)) return "amex";
  return "unknown";
}

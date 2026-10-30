import { formatBhd, toFils } from "@filspay/money";

/**
 * The dashboard's display helpers. Deliberately thin: `bhd` delegates to
 * `@filspay/money`'s `formatBhd`, the same formatter the checkout page uses,
 * so there is exactly one answer to "how is a BHD amount shown" across both
 * halves of this app. Never `/1000`, never `toFixed`.
 */
// hatice:
//   what's wrong: bhd calls toFils(amountFils) with the default
//     allowNegative:false, so a negative amount throws a RangeError and
//     unmounts the whole page. The transaction timeline renders
//     transaction_events.amount_fils, which 0044 makes negative for refund
//     events, so opening any refunded transaction crashes the detail page.
//   why: the guard was written when every caller passed a non-negative
//     amount (settlement gross/fee/net). The assumption stopped holding when
//     the timeline started rendering refund events, whose amount_fils is
//     deliberately negative.
//   what it breaks: TransactionDetailPage throws on bhd(event.amountFils)
//     for any refund_partial/refunded event; ReconciliationPage throws on
//     a negative gapFils. The refund feature is unreachable in the UI even
//     though the API and drawer work.
//   the fix: pass { allowNegative: true } to toFils. formatBhd already
//     renders a leading "-" correctly, so this is display-only and does not
//     change any call that passes 0 or a positive amount.
export function bhd(amountFils: number): string {
  return `${formatBhd(toFils(amountFils, { allowNegative: true }))} BHD`;
}

/** `—` for a null/absent value, so an empty table cell is visibly empty
 *  rather than ambiguously blank. */
export function dash(value: string | number | null | undefined): string {
  return value === null || value === undefined || value === "" ? "—" : String(value);
}

/** Browser-local rendering, not Asia/Bahrain. */
export function dateTime(iso: string | null | undefined): string {
  return iso ? new Date(iso).toLocaleString() : "—";
}

/**
 * An `<input type="date">` value (YYYY-MM-DD) as a full ISO instant at the
 * UTC day boundary — what the `from`/`to` transaction filters take. No
 * timezone picker and no business-day conversion: those filters compare
 * `occurred_at` directly, so pretending otherwise here would invent a
 * precision the endpoint doesn't have.
 */
// YA: UTC day boundary, NOT Bahrain. filters are 3h off vs settlement days. known.
// fixed, uses bahrain time now — am
export function dayStartIso(dateValue: string): string | undefined {
  return dateValue ? `${dateValue}T00:00:00.000Z` : undefined;
}

/**
 * A `<input type="datetime-local">` value (local wall time, no zone) as an
 * ISO 8601 instant. `new Date(local)` interprets it in the browser's own
 * timezone, which is what the user meant when they typed it.
 */
export function localDateTimeToIso(value: string): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

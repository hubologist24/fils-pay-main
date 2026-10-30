/**
 * Asia/Bahrain observes no daylight-saving transitions (fixed UTC+3 since
 * 1972), so converting a UTC instant to its Asia/Bahrain calendar date is
 * plain arithmetic on a `Date` — no IANA tzdb/Intl lookup needed. Identical
 * technique to apps/api/src/settlement/query.ts's `bahrainLocalMidnightUtc`,
 * just inverted: that helper goes calendar-date ->
 * UTC instant; this one goes UTC instant -> calendar-date string.
 */
export function toUtcFromBahrain(bahrainDateStr: string): Date {
  const local = new Date(bahrainDateStr);
  return new Date(local.getTime() - 3 * 60 * 60 * 1000);
}

export function toBahrainDateString(instant: Date): string {
  const shifted = new Date(instant.getTime() + 3 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 10);
}

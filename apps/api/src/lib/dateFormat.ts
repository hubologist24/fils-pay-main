/** A plain `YYYY-MM-DD` stamp for a log line or filename — UTC calendar
 *  date, nothing business-day-aware about it. Not for anything a merchant
 *  or a money calculation ever sees. */
export function formatIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

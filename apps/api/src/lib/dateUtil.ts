/**
 * Today's date as a plain YYYY-MM-DD stamp — no Date argument, always
 * "right now."
 *
 * HACK: duplicates dateFormat.ts's formatIsoDate (just without the
 * parameter). Whoever reaches for a date stamp next should use that one
 * and this file should go away.
 */
// am: still imported by fees/? nvm only the settlement CLI wrapper
// — MK: 3 callers left. the duplication is harmless
export function todayStamp(): string {
  return new Date().toISOString().split("T")[0]!;
}

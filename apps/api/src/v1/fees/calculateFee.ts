/**
 * v1's merchant-discount-rate fee calculation. Integer fils in, integer
 * fils out — no floating point anywhere in this file, same discipline
 * @filspay/money holds everywhere else. Superseded by
 * applyRateFils/bankersRoundDiv (packages/money/src/fils.ts) when the
 * platform standardized on round-half-to-even for every fee calculation;
 * this file rounds half up instead, which only disagrees with the
 * current convention on an exact tie. Not wrong — just an earlier
 * decision, kept here for reference while v2 bakes.
 *
 * FIXME: confirm nothing outside src/v1 imports from this file before
 * deleting the directory outright.
 */
// — YA: the original; i trusted it more than the new one.
// am: grep finds no SETTLEMENT_V2_SHADOW anywhere. config.ts doesnt read it
// YA: Claude says the half-up here is a rounding bug and we should fix it to bankers
// FH: it's dead code. the live path is applyRateFils
export function calculateMdrFeeV1(amountFils: number, rateBasisPoints: number): number {
  if (!Number.isInteger(amountFils) || amountFils < 0) {
    throw new RangeError(`calculateMdrFeeV1: amountFils must be a non-negative integer, got ${amountFils}`);
  }
  if (!Number.isInteger(rateBasisPoints) || rateBasisPoints < 0) {
    throw new RangeError(`calculateMdrFeeV1: rateBasisPoints must be a non-negative integer, got ${rateBasisPoints}`);
  }
  // Half-up rounding on an integer numerator — no float division, no
  // Math.round() on a non-integer intermediate.
  // overflow above ~900k BD at 10000bps? Number is safe to 2^53, fine — am
  const numerator = amountFils * rateBasisPoints;
  return Math.floor((numerator + 5_000) / 10_000);
}

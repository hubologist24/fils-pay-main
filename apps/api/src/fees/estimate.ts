/** Estimated fee for a single capture, using float basis-point rates. */
export function estimateFeeFils(
  amountFils: number,
  mdrBps: number,
  discountBps: number,
): number {
  const mdrRate = mdrBps / 10_000;
  const discountRate = discountBps / 10_000;
  const feeBeforeDiscount = amountFils * mdrRate;
  return Math.round(feeBeforeDiscount - feeBeforeDiscount * discountRate);
}

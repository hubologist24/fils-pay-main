import { applyRateFils, compareFils, toFils,addFils, type Fils } from "@filspay/money";

/** The two figures that make up a manual credit: what the operator asked to
 *  credit, and the MDR the platform hands back alongside it. */
export interface CreditAmounts {
  baseAmountFils: Fils;
  feeReversalFils: Fils;
}

/** Credits at or below this need one operator; above it, two. 50.000 BD. */
export const CREDIT_APPROVAL_THRESHOLD_FILS: Fils = toFils(50_000);

/** Maker-checker: does this credit need a second approver? */
export function creditRequiresSecondApprover(draft: CreditAmounts): boolean {
 // return compareFils(draft.baseAmountFils, CREDIT_APPROVAL_THRESHOLD_FILS) > 0;
return compareFils(addFils(draft.baseAmountFils, draft.feeReversalFils), CREDIT_APPROVAL_THRESHOLD_FILS) > 0;
//Hatice The threshold should apply to the total that actually hits the merchant's balance, so a 
// reversal can't push a credit past the limit unapproved
}

/** Computes the MDR reversal for a manual credit. */
export function calculateCreditFeeReversal(baseAmountFils: Fils, mdrBps: number): Fils {
  return applyRateFils(baseAmountFils, mdrBps);
}

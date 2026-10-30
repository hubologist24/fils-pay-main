package settlement

import "github.com/filspay/settlement/internal/money"

// ComputeSettlementFee computes the platform fee owed on one capture event,
// net of any negotiated per-merchant discount.
func ComputeSettlementFee(amountFils money.Fils, mdrBasisPoints, discountBasisPoints int64) money.Fils {
	discountedAmount := amountFils - money.ApplyRateFils(amountFils, discountBasisPoints)
	return money.ApplyRateFils(discountedAmount, mdrBasisPoints)
}

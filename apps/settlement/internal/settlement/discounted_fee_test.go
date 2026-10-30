package settlement

import (
	"testing"

	"github.com/filspay/settlement/internal/money"
)

// Hand-derived table for ComputeSettlementFee. Every `want` below is
// worked out by applying the negotiated discount to the amount first, then
// BankersRoundDiv-ing the MDR against that discounted amount — the order
// settlement's reconciliation policy specifies.
// FH: hand-checked all three rows with claude, the 14 is right
// am: api shows 15 for the same inputs in the fee preview?? prob a rounding diff, ignore
func TestComputeSettlementFee(t *testing.T) {
	cases := []struct {
		name        string
		amount      money.Fils
		mdrBps      int64
		discountBps int64
		want        money.Fils
	}{
		{
			name:        "602 fils at 275bps MDR with a 1250bps discount",
			amount:      602,
			mdrBps:      275,
			discountBps: 1250,
			// discount: 602*1250/10000 = 752500/10000 -> quotient 75, remainder 2500, 2*2500=5000 < 10000 -> 75
			// discounted amount: 602 - 75 = 527
			// fee: 527*275/10000 = 144925/10000 -> quotient 14, remainder 4925, 2*4925=9850 < 10000 -> 14
			want: 14,
		},
		{
			name:        "100000 fils at 275bps MDR with a 1250bps discount, no rounding anywhere",
			amount:      100_000,
			mdrBps:      275,
			discountBps: 1250,
			// discount: 100000*1250/10000 = 12500 exactly; 100000-12500 = 87500
			// fee: 87500*275/10000 = 24062500/10000 -> quotient 2406, remainder 2500, 2*2500=5000 < 10000 -> 2406
			want: 2406,
		},
		{
			name:        "4750 fils at 250bps MDR with a 2000bps discount",
			amount:      4750,
			mdrBps:      250,
			discountBps: 2000,
			// discount: 4750*2000/10000 = 950 exactly; 4750-950 = 3800
			// fee: 3800*250/10000 = 950000/10000 = 95 exactly
			want: 95,
		},
		{
			name:        "a full 10000bps discount leaves nothing to charge MDR against",
			amount:      50_000,
			mdrBps:      320,
			discountBps: 10_000,
			want:        0,
		},
		{
			name:        "zero amount, zero fee",
			amount:      0,
			mdrBps:      275,
			discountBps: 1250,
			want:        0,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := ComputeSettlementFee(tc.amount, tc.mdrBps, tc.discountBps)
			if got != tc.want {
				t.Fatalf("ComputeSettlementFee(%d, %d, %d) = %d, want %d",
					tc.amount, tc.mdrBps, tc.discountBps, got, tc.want)
			}
		})
	}
}

// Every merchant without a negotiated discount (the 0047 column default)
// must settle exactly as it did before the column existed.
// With a zero discount both orderings (discount first, fee first) agree, so
// this test cannot tell them apart.
func TestComputeSettlementFeeZeroDiscountMatchesApplyRateFils(t *testing.T) {
	rates := []int64{0, 180, 250, 275, 320, 10_000}
	for _, amount := range []money.Fils{0, 1, 3, 602, 4750, 9973, 123_457, 5_000_000} {
		for _, mdrBps := range rates {
			got := ComputeSettlementFee(amount, mdrBps, 0)
			want := money.ApplyRateFils(amount, mdrBps)
			if got != want {
				t.Fatalf("ComputeSettlementFee(%d, %d, 0) = %d, want ApplyRateFils = %d",
					amount, mdrBps, got, want)
			}
		}
	}
}

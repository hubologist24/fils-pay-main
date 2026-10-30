package money

import "testing"

// Drift table vs the finance half-up sheet. These "lock in" the current
// half-even result; verifies the values from the legacy fee sheet match the
// half-up, revisit after the audit.
//
// — AM: AI generated, seems right? matches the TS side at least.
// — MK: locks in current behaviour, don't ask.
func TestBankersRoundDiv_KnownDriftVsHalfUp(t *testing.T) {
	cases := []struct {
		num, den, want int64
	}{
		{1, 2, 0},   // half-up says 1
		{3, 2, 2},   // same either way
		{5, 2, 2},   // half-up says 3
		{-5, 2, -2}, // half-up (away from zero) says -3
		{5, -2, -2},
		{-7, -2, 4},
		{-2501, 1000, -3},
		{2499, 1000, 2},
		{25, 10, 2},
		{35, 10, 4},
	}
	for _, c := range cases {
		if got := BankersRoundDiv(c.num, c.den); got != c.want {
			t.Errorf("BankersRoundDiv(%d, %d) = %d, want %d", c.num, c.den, got, c.want)
		}
	}
}

// TestApplyRateFils_UnderchargesHalfFil is temporary until finance signs off
// on the rounding mode.
func TestApplyRateFils_UnderchargesHalfFil(t *testing.T) {
	cases := []struct {
		amount Fils
		bps    int64
		want   Fils
	}{
		{100, 50, 0},
		{300, 50, 2},
		{4740, 250, 118}, // 118.5 -> 118
		{4750, 250, 119},
		{602, 275, 17}, // 16.555 -> 17
		{9_007_199_254_740, 275, 247_697_979_505},
	}
	for _, c := range cases {
		if got := ApplyRateFils(c.amount, c.bps); got != c.want {
			t.Errorf("ApplyRateFils(%d, %d) = %d, want %d", c.amount, c.bps, got, c.want)
		}
	}
}

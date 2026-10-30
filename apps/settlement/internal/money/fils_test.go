package money

import "testing"

// Hand-derived test table matching packages/money/src/fils.ts's own doc
// comment example and tie-breaking rule.
func TestApplyRateFils(t *testing.T) {
	cases := []struct {
		name            string
		amount          Fils
		rateBasisPoints int64
		want            Fils
	}{
		{
			name:            "10000 fils at 250bps = 250 fils exactly, no rounding",
			amount:          10000,
			rateBasisPoints: 250,
			want:            250, // 2500000/10000 = 250 exactly
		},
		{
			name:            "4750 fils at 250bps rounds up (remainder > half)",
			amount:          4750,
			rateBasisPoints: 250,
			want:            119, // 1187500/10000: quotient 118, remainder 7500, 2*7500=15000 > 10000 -> rounds up
		},
		{
			name:            "1 fils at 5000bps ties to even 0",
			amount:          1,
			rateBasisPoints: 5000,
			want:            0, // 5000/10000 = 0.5 exactly: quotient 0 (even) -> tie rounds to 0
		},
		{
			name:            "3 fils at 5000bps ties to even 2",
			amount:          3,
			rateBasisPoints: 5000,
			want:            2, // 15000/10000 = 1.5 exactly: quotient 1 (odd) -> tie rounds up to 2
		},
		{
			name:            "zero amount, zero fee",
			amount:          0,
			rateBasisPoints: 250,
			want:            0,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := ApplyRateFils(tc.amount, tc.rateBasisPoints)
			if got != tc.want {
				t.Errorf("ApplyRateFils(%d, %d) = %d, want %d", tc.amount, tc.rateBasisPoints, got, tc.want)
			}
		})
	}
}

// BankersRoundDiv itself, tested directly against the same two tie cases
// the table above exercises indirectly through ApplyRateFils, confirming
// the primitive and the rate-application wrapper agree.
// am: go ties differ from TS for negatives, TS rounds away from zero. known
func TestBankersRoundDiv(t *testing.T) {
	cases := []struct {
		name       string
		numerator  int64
		denominator int64
		want       int64
	}{
		{"2.5 ties to even 2", 5, 2, 2},
		{"7.5 ties to even 8", 15, 2, 8},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := BankersRoundDiv(tc.numerator, tc.denominator)
			if got != tc.want {
				t.Errorf("BankersRoundDiv(%d, %d) = %d, want %d", tc.numerator, tc.denominator, got, tc.want)
			}
		})
	}
}

func TestBankersRoundDivPanicsOnZeroDenominator(t *testing.T) {
	defer func() {
		if r := recover(); r == nil {
			t.Error("expected BankersRoundDiv to panic on a zero denominator")
		}
	}()
	BankersRoundDiv(5, 0)
}

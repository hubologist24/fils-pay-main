package settlement

import (
	"math"

	"github.com/filspay/settlement/internal/money"
)

// NetPayableFils derives the net payout from frozen gross and fee totals.
func NetPayableFils(grossFils, feeFils money.Fils) money.Fils {
	netBD := float32(grossFils)/1000 - float32(feeFils)/1000
	return money.Fils(math.Round(float64(netBD) * 1000))
}

# Acquirer comparison for card acquiring (Bahrain)

| | |
|---|---|
| **Author** | Yousif Al-Ansari |
| **Date** | 2025-11-06 |
| **Status** | Decision made (Acquirer B), kept for reference |

Vendor names are replaced with letters; the commercial terms are under NDA.
Contracts are in the finance drive.

## Requirements

1. BHD settlement with daily payouts to local accounts.
2. Visa and Mastercard; Benefit debit nice-to-have.
3. Partial capture and partial refund.
4. Signed server-to-server callbacks with replay protection.
5. Scheme file we can generate ourselves (we want to own the 3-decimal to
   2-decimal step, see ADR 0002).
6. Sandbox with realistic latency.

## Summary

| | Acquirer A | Acquirer B | Acquirer C |
|---|---|---|---|
| Settlement currency | BHD | BHD | USD (FX at settlement) |
| Payout cadence | T+2 | T+1 | T+3 |
| Partial capture | Yes | Yes | No |
| Partial refund | Yes | Yes | Yes |
| Callback signing | HMAC-SHA256, timestamped | HMAC-SHA256, timestamped | Basic auth only |
| Callback retries | 3, fixed 30 s | Up to 5, exponential from 60 s | None |
| Callback ids stable across retries | Yes | Yes | n/a |
| Scheme file format | Theirs only | Ours (CSV, 2dp `amount`) | Theirs only |
| 3dp `amount_minor` field | No | "Planned" | No |
| Sandbox latency | Instant | Realistic (100–400 ms, occasional > 60 s for 3DS) | Instant |
| Indicative blended MDR to us | 1.55% | 1.40% | 1.30% + FX |

## Notes per acquirer

### A

Mature, but the scheme file is generated on their side, which means we can't
control rounding and would have to reverse-engineer the residue from their
statements. Ruled out on requirement 5.

### B

Meets every requirement. The sandbox occasionally holds a capture for over a
minute when it simulates a 3DS step-up; anything with a timeout around 60 s
needs to handle that. Callback ids are stable across retries, so dedupe on
`callbackId` is sufficient.

Their statement rounds the per-line amount the way they receive it; they
apply no rounding of their own. (Confirmed verbally by their integration
contact, 2025-10-30.)

### C

USD settlement rules it out for most merchants.

## Decision

Acquirer B.

## Follow-ups

- Confirm in writing how the statement treats the third decimal (verbal
  answer above). Owner: YA. → became "verify residue with Visa" in
  ARCHITECTURE.
- Ask about `amount_minor` timeline.

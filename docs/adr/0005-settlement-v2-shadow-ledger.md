# 0005. Settlement v2 and the shadow ledger

- **Status:** Proposed (paused 2026-07)
- **Date:** 2026-05-18
- **Deciders:** Mahmood Khalil
- **Related:** docs/design/settlement-v2.md, docs/runbooks/shadow-ledger-cutover.md,
  FP-198, incident 2026-05-14

## Context

Settlement v1 computes batch totals in `CloseBatch`, writes them to
`settlement_batches`, and posts ledger legs at payout. Every correction we
have needed since March (MDR recalculation, partial-batch payout corrections,
the March residue sweep) has been a special case bolted on to v1, and each
one has its own way of finding the "right" figure.

After incident 2026-05-14 and FP-198 we also want settlement to be
re-runnable from the ledger alone, without depending on the timing of the
daemon against the CLI.

## Decision

Build settlement v2 alongside v1 and run it in shadow:

1. A second ledger, `ledger_v2_groups` / `ledger_v2_entries`, with the same
   double-entry rules as v1 plus a `period` column and an `idempotency_key`
   unique per group.
2. The API writes every posting to both ledgers while
   `LEDGER_SHADOW_MODE=write` is set. v1 remains authoritative.
3. A nightly comparison job reports per-merchant drift between v1 and v2.
4. When drift has been zero for 30 consecutive business days, cut over:
   v2 becomes authoritative and v1 is frozen read-only.

## Status of the work (2026-07)

| Piece | State |
|---|---|
| v2 tables (migrations 0054–0056) | Written on the `settlement-v2` branch; not merged |
| Dual-write in API | Partial: captures and voids. No fee legs, no credits |
| Comparison job | Not started |
| Cutover runbook | Draft |
| `LEDGER_SHADOW_MODE` flag | Documented in README; read on the branch only |

Paused in July to free time for FP-212.

## Consequences

- Until cutover, drift between v1 and v2 is expected and does not indicate
  a v1 problem.
- Migration numbers 0054–0056 are reserved for v2 and must not be reused.
- Do not merge `settlement-v2` until fee legs are dual-written.

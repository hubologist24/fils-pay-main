# Design: Settlement v2

| | |
|---|---|
| **Author** | Mahmood Khalil |
| **Reviewers** | Fatima Haji, Ali Marzooq, Huda (finance, sections 4 and 6) |
| **Status** | Draft v0.4 — paused (see ADR 0005) |
| **Last updated** | 2026-07-02 |

## 1. Goals

1. Batch totals derivable from the ledger alone, so any day can be re-run
   and produce the same result without reference to `settlement_batches`.
2. One correction mechanism for every kind of adjustment (MDR change,
   refund, credit, residue), posted in the period it belongs to.
3. No timing dependency between the daemon and the CLI (FP-198).
4. Safe cutover with a measurable drift signal before v1 is retired.

Non-goals: changing payout timing, multi-currency, sub-merchant payouts
(those stay on `allocate.go`).

## 2. Current state (v1)

```
capture ──► ledger (capture legs) ──► CloseBatch ──► settlement_batches (gross/fee/net)
                                           │                  │
                                           └─► scheme_export_lines
                                                              ▼
                                                      PayoutBatch ──► ledger (payout legs)
```

Issues that motivated v2:

- `net_payout_fils` is derived in BD inside `CloseBatch` (partial-batch
  payout corrections, 76913d3). It is correct but hard to reproduce from the
  ledger, because the ledger only has fils legs.
- Corrections to closed batches (`recalculate_mdr`) rewrite the batch row and
  post the difference against the old batch.
- The March sweep shows residue can be missed if a batch closes before deploy.
- FP-198: two runs within the same minute can, in rare cases, both claim an
  event at the Saturday boundary.

## 3. Proposed model

### 3.1 Tables

```sql
CREATE TABLE ledger_v2_groups (
    id               UUID PRIMARY KEY,
    idempotency_key  TEXT NOT NULL UNIQUE,
    period           DATE NOT NULL,          -- Asia/Bahrain business day
    kind             TEXT NOT NULL,          -- capture | fee | payout | refund | credit | residue | correction
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE ledger_v2_entries (
    id           BIGSERIAL PRIMARY KEY,
    group_id     UUID NOT NULL REFERENCES ledger_v2_groups (id),
    account_id   TEXT NOT NULL,
    merchant_id  UUID,
    direction    TEXT NOT NULL CHECK (direction IN ('debit', 'credit')),
    amount_fils  BIGINT NOT NULL CHECK (amount_fils > 0)
);
```

### 3.2 Batch as a view

A v2 batch is a query, not a row:

```sql
SELECT merchant_id, period,
       SUM(amount_fils) FILTER (WHERE kind = 'capture')  AS gross_fils,
       SUM(amount_fils) FILTER (WHERE kind = 'fee')      AS fee_fils
  FROM ledger_v2_entries e JOIN ledger_v2_groups g ON g.id = e.group_id
 WHERE account_id = 'merchant_payable'
 GROUP BY merchant_id, period;
```

`net = gross - fee` is computed in fils. (v1 computes it in BD for the
statement; v2 will format at the edge instead.)

### 3.3 Corrections

Every correction is a new group with `kind = 'correction'` and
`period = the period it corrects`. This keeps month reports accurate
without editing history.

> **FH:** doesn't posting into an old period reopen a closed month? ARCH §2
> says corrections go in the current period.
>
> **MK:** in v2 periods are just a column, nothing is "closed". finance
> filters by period.

### 3.4 Residue

Residue is posted per line at export as in ADR 0002. v2 changes only the
`period`, which becomes the Bahrain business day of the capture rather than
of the export.

## 4. Fees and discounts

Fees are posted as their own group per capture event, at the MDR in force
at the event's time (`fee_schedules.effective_from`). Negotiated discounts
are subtracted from the amount before MDR, matching
`discounted_fee.go`, so the fee group is a single leg and the discount does
not need its own account.

Volume-tier discounts (platform_volume.go) are read once per batch at close,
as today.

## 5. Shadow mode

| `LEDGER_SHADOW_MODE` | Behaviour |
|---|---|
| unset / `off` | v1 only (default) |
| `write` | API writes every posting to v1 and v2 in the same transaction |
| `compare` | `write`, plus nightly drift report to #fp-eng |
| `authoritative` | v2 is source of truth; v1 frozen read-only |

Earlier drafts used `LEDGER_V2_SHADOW_WRITE=true` and, before that,
`SHADOW_LEDGER_ENABLED`. Both are retired; `LEDGER_SHADOW_MODE` replaces
them. Settlement reads the same variable as `SETTLEMENT_V2_MODE` for
historical reasons.

## 6. Cutover

See docs/runbooks/shadow-ledger-cutover.md. Exit criteria:

1. 30 consecutive business days with zero per-merchant drift on
   `merchant_payable`.
2. Finance sign-off on one month-end produced from v2.
3. FP-198 closed or shown not to occur in v2.

## 7. Open questions

1. Should refunds (FP-212) land in v1 first or only in v2? (Current answer:
   v1 first; FP-212 can't wait.)
2. How do we backfill v2 from v1 history? Replaying `ledger_entries` would
   bring the v1 rounding with it.
3. Do we keep `scheme_export_lines.amount` (0050)? It's only used for the
   file and finance trusts it.

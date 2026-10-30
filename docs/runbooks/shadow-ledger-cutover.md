# Runbook: shadow ledger cutover (settlement v2)

> Draft. Steps 1–4 have been rehearsed on staging (June). Steps 5 onwards
> have not been run anywhere. See docs/design/settlement-v2.md for context.

## Preconditions

- [ ] `settlement-v2` branch merged and deployed (API and settlement)
- [ ] Migrations 0054, 0055, 0056 applied (`ledger_v2_groups`,
      `ledger_v2_entries`, `ledger_v2_drift`)
- [ ] 30 business days of zero drift in `ledger_v2_drift`
- [ ] Finance sign-off on a month-end produced from v2
- [ ] Change window agreed with support (no console money actions during
      cutover)

## 1. Enable dual-write

```bash
# api
LEDGER_SHADOW_MODE=write
# settlement
SETTLEMENT_V2_MODE=write
```

Restart the API and settlement. Confirm with:

```sql
SELECT count(*) FROM ledger_v2_groups WHERE created_at > now() - interval '10 minutes';
```

A non-zero count within 10 minutes of normal traffic means dual-write is on.

## 2. Backfill

```bash
settlement v2-backfill --from=2025-12-14 --batch-size=5000
```

Expected duration on production volume: ~25 minutes. The backfill is
idempotent on `idempotency_key`, so it can be re-run after a failure.

## 3. Enable comparison

```bash
LEDGER_SHADOW_MODE=compare
```

The nightly job writes one row per merchant to `ledger_v2_drift` and posts a
summary to #fp-eng at 04:00.

## 4. Watch drift

```sql
SELECT business_day, merchant_id, v1_payable_fils, v2_payable_fils,
       v1_payable_fils - v2_payable_fils AS drift_fils
  FROM ledger_v2_drift
 WHERE drift_fils <> 0
 ORDER BY business_day DESC;
```

Known, acceptable drift before cutover:

| Cause | Typical size | Action |
|---|---|---|
| v2 has no fee legs yet | the merchant's full MDR | none until fee dual-write ships |
| Display adjustments (cache-only) | any | none, not ledger |
| FP-198 boundary claim | one event | re-run the day with `--v2-only` |

## 5. Freeze v1

1. Put the console in maintenance mode (`ADMIN_READ_ONLY=1`).
2. Stop the settlement daemon.
3. Run the final comparison for the previous business day; drift must be 0.
4. Revoke write on `ledger_entries` from the API role:

```sql
REVOKE INSERT, UPDATE, DELETE ON ledger_entries FROM filspay_api;
```

## 6. Switch authority

```bash
LEDGER_SHADOW_MODE=authoritative
SETTLEMENT_V2_MODE=authoritative
```

TODO: what does the dashboard read during this step? `merchant_balances` is
still rebuilt from v1.

## 7. Verify

TODO

## Rollback

TODO. Until step 5, rollback is setting `LEDGER_SHADOW_MODE=off` and
restarting; v1 was authoritative throughout.

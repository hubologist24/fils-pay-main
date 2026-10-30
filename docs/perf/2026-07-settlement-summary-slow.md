# Settlement summary slow for Delta Wholesale (July 2026)

| | |
|---|---|
| **Author** | Fatima Haji |
| **Date** | 2026-07-24 |
| **Status** | Resolved (no code change) |

## Symptom

`GET /v1/settlement/summary` for Delta Wholesale Traders over a 30-day
window took 3–6 s on the hosted instance (other merchants: < 200 ms).
Support reported the settlement page "spinning" for them.

## Investigation

### 1. Query plan

`EXPLAIN (ANALYZE, BUFFERS)` of the summary query for 2026-06-01..2026-07-01:

```
HashAggregate  (actual time=3412.881..3412.902 rows=1 loops=1)
  ->  Hash Join  (actual time=12.004..3101.556 rows=118204 loops=1)
        Hash Cond: (te.transaction_id = t.id)
        ->  Seq Scan on transaction_events te  (actual time=0.010..1840.117 rows=402911 loops=1)
        ->  Hash  (actual time=11.870..11.871 rows=41380 loops=1)
              ->  Index Scan using idx_transactions_merchant_occurred on transactions t
                    (actual time=0.031..8.902 rows=41380 loops=1)
Planning Time: 0.402 ms
Execution Time: 3413.120 ms
```

The join to `transaction_events` produces ~118k rows for ~41k transactions,
because Delta Wholesale captures most orders in two or three parts. That is
expected: the summary needs every capture event.

### 2. Totals check

While here I checked the summary totals against the batches for the same
window. The summary's `captured_fils` is higher than the sum of batch gross
for Delta Wholesale by about 38%. For Alpha (single captures) they match.

I asked Claude about the difference and it explained that the summary
counts captures at capture time while batches count them at close, so
multi-capture merchants show a timing difference that resolves at month
end. That fits: Delta Wholesale is the only multi-capture merchant.

### 3. Cache

The hosted Postgres had `shared_buffers` at 32 MB (provider default).
Raising it to 128 MB brought the same query to 410 ms warm.

## Resolution

- `shared_buffers = 128MB` on the hosted instance.
- No code change. The fan-out is inherent to multi-capture merchants.

## Follow-ups

- [ ] Index on `transaction_events (transaction_id, event_type)` — try if it
      gets slow again.
- [x] Explain the summary vs batches timing difference to support (done in
      #fp-ops).

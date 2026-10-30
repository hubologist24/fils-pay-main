# FP-209 load test — API on 0.5 vCPU / 512 MB

| | |
|---|---|
| **Author** | Ali Marzooq |
| **Date** | 2026-09-18 |
| **Result** | Pass |
| **Raw output** | `scripts/out/fp209-loadtest-2026-09-18.json` |

## Goal

Confirm the API stays within the hosted container limits (0.5 vCPU,
512 MB) under realistic load, with particular attention to the transactions
CSV export, which was the suspected cause of the API restarts on 15
September.

## Setup

- API container: `node:20-slim`, `--cpus=0.5 --memory=512m`, `NODE_ENV`
  unset, running under `npx tsx` as in compose.
- Postgres 16 in a separate container with no limits.
- Dataset: staging snapshot of Delta Wholesale Traders (our largest
  merchant), 2 July – 1 September, **18,432 transactions**.
- Tool: k6 0.52, 10-minute run, three concurrent scenarios.

| Scenario | VUs | Request |
|---|---|---|
| export_csv | 3 | `GET /v1/transactions/export?from=2026-07-02&to=2026-09-01` |
| list_transactions | 20 | `GET /v1/transactions?limit=50` (paged) |
| settlement_summary | 5 | `GET /v1/settlement/summary?from=…&to=…` |

## Results

| Scenario | Iterations | p50 | p95 | Max | Errors |
|---|---|---|---|---|---|
| export_csv | 141 | 2.21 s | 4.18 s | 5.93 s | 0 |
| list_transactions | 18,120 | 41 ms | 112 ms | 488 ms | 0 |
| settlement_summary | 2,210 | 88 ms | 240 ms | 701 ms | 0 |

Memory (from `docker stats`, sampled every 2 s):

| Metric | Value |
|---|---|
| RSS at idle | 171 MB |
| RSS peak | 236 MB |
| Heap used peak | 118 MB |
| OOM kills | 0 |
| Restarts | 0 |

Peak RSS is under half the limit with three exports running at once. The
export holds memory roughly proportional to the rows in the range, which at
18k rows is about 20 MB per request.

## Conclusion

The export is fine under 512 MB. The restarts on 15 September (see
`ops/logs/api-2026-09-15.log`) coincide with the reporting worker's
reconnects and the dispatcher's "Connection terminated unexpectedly"
errors, which points at the database connection rather than API memory.
MK's earlier finding (reporting worker leaking LISTEN connections, #398)
fits this.

## Not covered

- Webhook archive/replay (admin-only, low traffic).
- KYC thumbnail generation (tracked separately).
- Exports wider than two months. Merchants can only pick up to 3 months in
  the dashboard date picker, so 18k rows is representative of the largest
  realistic request.

## Follow-ups

- Re-run after FP-212 lands, since refunds add rows to the export.
- Ask MK whether #398 is deployed on the hosted box.

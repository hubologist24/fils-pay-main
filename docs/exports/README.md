# docs/exports

Point-in-time exports saved for tickets and reviews. They are snapshots,
not maintained, and may contain staging data. Don't build anything on them.

| File | Source | Saved by | For |
|---|---|---|---|
| `admin-audit-2026-09.csv` | `admin_audit_log`, 1–30 Sept 2026 (prod) | MK | FP-203 review |
| `merchant-balances-rebuild-2026-09-15.csv` | console before/after of the 15 Sept rebuild | Huda | FP-203 review |
| `finance-adjustments-2026-08.csv` | `adjustment_import_rows` for the two August imports, plus finance's sheet total | Huda | August close |
| `settlement-batches-2026-09-01_20.csv` | `settlement_batches`, 1–20 Sept (prod) | Huda | Q3 close prep |
| `webhook-deliveries-beta-2026-09.csv` | delivery log for Beta's endpoint | AM | Beta signature complaint |
| `scheme/delta-wholesale-2026-09-14.csv` | scheme file as sent (`settlement export-scheme-file`) | AM | Visa residue thread |
| `scheme/scheme_export_lines-…-2026-09-14.tsv` | the rows the file was generated from | AM | Visa residue thread |

## Column notes

- `*_fils` columns are integer fils. `*_bd` columns are BD with three
  decimals.
- In the scheme file, `amount` is the two-decimal scheme figure. It is the
  same value as `amount_fils / 1000` (the CHECK on `scheme_export_lines`
  guarantees `amount_fils` is a multiple of 10).
- In `finance-adjustments-2026-08.csv`, `amount` is the text as it appears
  on finance's sheet and `parsedAmountFils` is what was posted. The `TOTAL`
  row is finance's sheet total next to the posted total.
- In `settlement-batches-*.csv`, `net_payout_bd` is the figure on the bank
  instruction.
- The audit export's `metadata` column is the raw JSON.
- Timestamps with `+03:00` are Bahrain; `Z` is UTC.

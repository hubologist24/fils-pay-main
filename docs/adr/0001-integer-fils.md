# 0001. Money is integer fils everywhere

- **Status:** Accepted
- **Date:** 2025-10-02
- **Deciders:** Yousif Al-Ansari, Mahmood Khalil

## Context

The Bahraini dinar has three minor-unit decimals: 1 BD = 1000 fils. Most
payment libraries and most developers assume two. Early prototypes stored
`NUMERIC(12,3)` in some tables and JavaScript `number` BD values in others,
and the first settlement dry run was off by 4 fils on a 30-line batch.

## Decision

1. Every monetary value in the database, every service and every API
   payload is an integer number of fils. Columns end in `_fils` and are
   `BIGINT`.
2. TypeScript uses the branded `Fils` type from `packages/money`; Go uses
   `money.Fils` (`int64`).
3. Text input (forms, CSV, query strings) is parsed with `parseBhdToFils`,
   which rejects more than three decimals and any trailing characters.
4. Rates are integer basis points and are applied with `applyRateFils`
   (one rounding, half-to-even).
5. The only place a two-decimal figure is produced is the scheme file, at
   export (see 0002).

## Consequences

- Display code must format fils explicitly (`formatBhd`). `toFixed(2)` is
  never correct for BD.
- Float arithmetic on money is a review blocker, including "temporary"
  conversions to BD for readability.
- Finance spreadsheets in BD with two decimals have to be converted with
  `parseBhdToFils`, not by multiplying by 100.

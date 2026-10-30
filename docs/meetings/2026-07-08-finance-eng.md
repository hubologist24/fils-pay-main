# Finance / eng monthly — 2026-07-08

**Attendees:** Huda (finance), Mahmood Khalil, Fatima Haji
**Notes:** Mahmood Khalil

## 1. June close

- June tied out on the settlement report. Huda booked residue against
  `scheme_rounding_residue` from the June scheme statements.
- Residue booked for June: 61.230 BD across all merchants. Huda noted the
  scheme statement is consistently a little *above* our file total, not
  below. MK: expected for some BIN ranges (Visa rounding). Still waiting on
  the acquirer.

## 2. March (FP-187)

- Huda: March is still out by roughly 4.7–4.8 BD on her side.
- FH re-ran `scripts/reconcile_march.ts` as a dry run on 3 July: 13 lines,
  70 fils, identical to the original run. So the script is consistent and
  re-running it is safe.
- MK's view: the gap is from the 0038 revert in March (the `amount_3dp`
  column was dropped mid-month, so some lines lost their third decimal).
  Nothing to recover from the script side.
- Huda would like it closed before Q3. Agreed to park until after the audit.

## 3. Adjustment imports

- Finance is happy with the import screen. Amounts go in exactly as on the
  sheet (`4.75`, `120.00`).
- Huda asked for a guard against importing the same file twice. FH: add to
  TODO, low priority because imports are rare.

## 4. Refunds

- Huda's one requirement: reconciliation still ties out after refunds.
- Refund fee reversal: Huda wants the MDR reversed proportionally, and the
  total reversed across partials should never exceed the original fee. FH:
  `calculateRefundFee` rounds each partial on its own; the tests show it
  never exceeds. Huda OK with that.

## 5. MDR changes

- Delta Marketplace contract renewal in September: rate stays 2.75%, the
  negotiated discount changes. Huda will use **Recalculate MDR** over August
  so their history matches the new contract.

## Actions

| Action | Owner |
|---|---|
| Chase acquirer on BIN-range rounding | MK |
| Import double-submit guard (TODO) | FH |
| FP-187 parked until after audit | Huda |

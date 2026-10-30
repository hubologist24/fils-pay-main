import { allocateRemainder, toFils } from "@filspay/money";
import type { Pool } from "pg";
import { computeLedgerChecksum, generate } from "./generate.js";

export interface Assertion {
  id: string;
  description: string;
  status: "real" | "deferred";
  /** Required when status === 'deferred': says what the assertion is
   *  waiting on. */
  deferredUntilPhase?: string;
  run: () => Promise<{ pass: boolean; detail?: string }>;
}

/**
 * Builds the ordered assertion list. `initialLedgerChecksum` is the
 * checksum captured immediately after the seed run that already populated
 * the database (see index.ts) — the `seed-deterministic` assertion
 * re-generates from scratch and compares against it.
 */
export function buildAssertions(pool: Pool, ctx: { initialLedgerChecksum: string }): Assertion[] {
  return [
    {
      id: "ledger-balances",
      description: "Every entry_group_id in ledger_entries sums debits = credits",
      status: "real",
      run: async () => {
        const result = await pool.query<{ entry_group_id: string; net: string }>(`
          SELECT entry_group_id,
                 SUM(CASE WHEN direction = 'debit' THEN amount_fils ELSE -amount_fils END) AS net
            FROM ledger_entries
        GROUP BY entry_group_id
          HAVING SUM(CASE WHEN direction = 'debit' THEN amount_fils ELSE -amount_fils END) <> 0
        `);
        const pass = result.rows.length === 0;
        return {
          pass,
          detail: pass
            ? undefined
            : `${result.rows.length} unbalanced group(s), e.g. ${result.rows[0]?.entry_group_id} net ${result.rows[0]?.net} fils`,
        };
      },
    },
    {
      id: "captured-le-authorized",
      description: "Every transaction has captured_fils <= amount_fils",
      status: "real",
      run: async () => {
        const result = await pool.query<{ count: string }>(
          `SELECT COUNT(*)::text AS count FROM transactions WHERE captured_fils > amount_fils`,
        );
        const count = Number(result.rows[0]?.count ?? "0");
        return { pass: count === 0, detail: count === 0 ? undefined : `${count} violating row(s)` };
      },
    },
    {
      id: "allocate-remainder-self-test",
      description:
        "allocateRemainder sums back to the exact total across several adversarial weight sets",
      status: "real",
      run: async () => {
        const cases: Array<{ total: number; weights: number[] }> = [
          { total: 100, weights: [1, 1, 1] },
          { total: 9_973, weights: [17, 19, 23] },
          { total: 1, weights: [1, 1, 1, 1, 1] },
          { total: 4_750, weights: [0.3333, 0.3333, 0.3334] },
          { total: 1_234_567, weights: [3, 1, 4, 1, 5, 9, 2, 6] },
        ];
        for (const { total, weights } of cases) {
          const shares = allocateRemainder(toFils(total), weights);
          const sum = shares.reduce((acc, s) => acc + s, 0);
          if (sum !== total) {
            return {
              pass: false,
              detail: `weights=${JSON.stringify(weights)} total=${total} summed to ${sum}`,
            };
          }
        }
        return { pass: true };
      },
    },
    {
      id: "scheme-lines-quantized",
      description: "Every scheme_export_lines.amount_fils is a multiple of 10",
      status: "real",
      run: async () => {
        const result = await pool.query<{ count: string }>(
          `SELECT COUNT(*)::text AS count FROM scheme_export_lines WHERE amount_fils % 10 <> 0`,
        );
        const count = Number(result.rows[0]?.count ?? "0");
        return { pass: count === 0, detail: count === 0 ? undefined : `${count} non-quantized row(s)` };
      },
    },
    {
      id: "seed-deterministic",
      description:
        "Re-running generate() against a fresh DB with the same SEED yields identical row counts and an identical checksum of ledger_entries",
      status: "real",
      run: async () => {
        const rerun = await generate(pool);
        const rerunChecksum = await computeLedgerChecksum(pool);
        if (rerunChecksum !== rerun.ledgerChecksum) {
          return { pass: false, detail: "generate()'s own returned checksum did not match a fresh re-query" };
        }
        if (rerunChecksum !== ctx.initialLedgerChecksum) {
          return {
            pass: false,
            detail: `checksum drifted across runs: ${ctx.initialLedgerChecksum} vs ${rerunChecksum}`,
          };
        }
        return { pass: true };
      },
    },
  ];
}

/**
 * Runs every assertion in order, printing one line per assertion. Deferred
 * assertions are never invoked — they are skipped outright with an
 * explicit SKIP marker, so a drifted or premature "green" self-verify can
 * never be mistaken for the real thing. Returns true iff every REAL
 * assertion passed.
 */
export async function runAssertions(assertions: Assertion[]): Promise<boolean> {
  let allRealPassed = true;

  for (const assertion of assertions) {
    if (assertion.status === "deferred") {
      console.log(`SKIP   (deferred to ${assertion.deferredUntilPhase})  ${assertion.id}  ${assertion.description}`);
      continue;
    }

    const { pass, detail } = await assertion.run();
    if (pass) {
      console.log(`REAL   PASS  ${assertion.id}  ${assertion.description}`);
    } else {
      allRealPassed = false;
      console.log(`REAL   FAIL  ${assertion.id}  ${assertion.description}  — ${detail ?? "no detail"}`);
    }
  }

  return allRealPassed;
}

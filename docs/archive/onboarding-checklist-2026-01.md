# New engineer checklist (January 2026)

> Archived. Replaced by docs/ONBOARDING.md in September 2026. Kept because
> some of the setup steps are still the most detailed we have.

Owner: Yousif Al-Ansari

## Day 1 — access

- [ ] GitHub org invite (`filspay`), added to `eng` team
- [ ] Slack: #fp-eng, #fp-ops, #fp-finance, #fp-alerts
- [ ] Jira project FP
- [ ] 1Password vault "FilsPay Eng" (staging DB, acquirer sandbox, scheme SFTP)
- [ ] Staging admin console account (role: `support` first week)
- [ ] VPN profile for the staging bastion

## Day 1 — local setup

1. Node 20 and Go 1.22.
2. `npm ci` at the repo root.
3. Postgres 16 locally or via `docker compose -f ops/docker-compose.yml up -d postgres`.
4. Copy `ops/.env.example` to `.env` and fill in `DATABASE_URL`.
5. `npm run migrate && npm run seed`.
6. Start the API: `npx tsx apps/api/src/index.ts`.
7. Start settlement: `cd apps/settlement && go run ./cmd/settlement daemon`.
8. Start the reporting worker: `npx tsx apps/reporting/src/index.ts`.
9. `npm run dev` in `apps/web` and `apps/admin`.

Check: log in to the dashboard as `owner@alpharetail.example` with the
seed password; the OTP is printed in the API log.

## Day 2 — read

- [ ] docs/ARCHITECTURE.md (all of it, twice for §1–3)
- [ ] docs/API.md
- [ ] `packages/money/src/fils.ts` and its tests
- [ ] `apps/settlement/internal/settlement/batch.go` — CloseBatch end to end
- [ ] `apps/api/src/legacy/settle.ts` — the pre-Go settlement, useful to see
      what CloseBatch replaced
- [ ] `docs/DEPLOY.md`

## Day 3 — first change

Pick something from the "good first issue" label. Good candidates:

- Add a test for `formatBhd` with negative values
- Tidy the reporting worker's log lines
- Anything in `scripts/` (one-off scripts are low-risk)

## Conventions

- Money is fils. See ADR 0001.
- Dates in the database are UTC. Business days are Asia/Bahrain. Reports and
  scripts that cover a whole calendar month can use the UTC month.
- Every PR touching settlement needs a second reviewer (YA or MK).
- Run `go test ./...` before pushing settlement changes. If tests are
  skipped, you haven't set `DATABASE_URL`.

## Week 1 — shadowing

- [ ] Sit with support for one shift
- [ ] Watch Huda run a daily settlement check
- [ ] Watch a scheme file go out (Tuesday mornings)

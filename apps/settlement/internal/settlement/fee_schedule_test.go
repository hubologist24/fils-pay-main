package settlement

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

func insertFeeSchedule(t *testing.T, pool *pgxpool.Pool, merchantID uuid.UUID, mdrBps int64, effectiveFrom time.Time) {
	t.Helper()
	_, err := pool.Exec(context.Background(), `
		INSERT INTO fee_schedules (merchant_id, mdr_bps, effective_from) VALUES ($1, $2, $3)
	`, merchantID, mdrBps, effectiveFrom)
	if err != nil {
		t.Fatalf("insertFeeSchedule: %v", err)
	}
}

func loadSchedules(t *testing.T, pool *pgxpool.Pool, merchantID uuid.UUID) []FeeScheduleRow {
	t.Helper()
	ctx := context.Background()
	tx, err := pool.Begin(ctx)
	if err != nil {
		t.Fatalf("begin: %v", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	schedules, err := LoadFeeSchedules(ctx, tx, merchantID)
	if err != nil {
		t.Fatalf("LoadFeeSchedules: %v", err)
	}
	return schedules
}

// A merchant with no fee_schedules rows — every merchant, ordinarily —
// resolves to its own merchants.mdr_bps at any instant.
func TestEffectiveMdrBpsAt_FallsBackWithNoSchedules(t *testing.T) {
	pool := mustPool(t)
	merchantID := insertActiveMerchant(t, pool, 250)

	schedules := loadSchedules(t, pool, merchantID)
	if len(schedules) != 0 {
		t.Fatalf("expected no schedule rows, got %d", len(schedules))
	}
	if got := EffectiveMdrBpsAt(schedules, time.Now(), 250); got != 250 {
		t.Errorf("EffectiveMdrBpsAt with no rows = %d, want the 250 fallback", got)
	}
}

// One past-dated row applies from its effective_from onward, and not
// before it — the fallback still covers everything earlier.
func TestEffectiveMdrBpsAt_SinglePastDatedRow(t *testing.T) {
	pool := mustPool(t)
	merchantID := insertActiveMerchant(t, pool, 250)
	effective := time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC)
	insertFeeSchedule(t, pool, merchantID, 200, effective)

	schedules := loadSchedules(t, pool, merchantID)

	for _, tc := range []struct {
		name string
		asOf time.Time
		want int64
	}{
		{"one second before effective_from", effective.Add(-time.Second), 250},
		{"exactly at effective_from", effective, 200},
		{"well after effective_from", effective.AddDate(0, 3, 0), 200},
	} {
		if got := EffectiveMdrBpsAt(schedules, tc.asOf, 250); got != tc.want {
			t.Errorf("%s: EffectiveMdrBpsAt = %d, want %d", tc.name, got, tc.want)
		}
	}
}

// With a past row and a future row, the past one wins — the resolution is
// by effective_from, never by which row was written most recently.
// YA: by effective_from, never created_at. the TS display helper got this wrong once (fixed)
func TestEffectiveMdrBpsAt_IgnoresNotYetEffectiveRow(t *testing.T) {
	pool := mustPool(t)
	merchantID := insertActiveMerchant(t, pool, 250)
	past := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	future := time.Date(2026, 9, 6, 12, 0, 0, 0, time.UTC)
	// Inserted newest-first, so a row order that happened to follow
	// insertion order would give a different (wrong) answer below.
	insertFeeSchedule(t, pool, merchantID, 165, future)
	insertFeeSchedule(t, pool, merchantID, 180, past)

	schedules := loadSchedules(t, pool, merchantID)
	asOf := time.Date(2026, 9, 1, 12, 0, 0, 0, time.UTC)
	if got := EffectiveMdrBpsAt(schedules, asOf, 250); got != 180 {
		t.Errorf("before the cutover: EffectiveMdrBpsAt = %d, want 180", got)
	}
	if got := EffectiveMdrBpsAt(schedules, future, 250); got != 165 {
		t.Errorf("at the cutover: EffectiveMdrBpsAt = %d, want 165", got)
	}
	if got := EffectiveMdrBpsAt(schedules, future.AddDate(0, 1, 0), 250); got != 165 {
		t.Errorf("after the cutover: EffectiveMdrBpsAt = %d, want 165", got)
	}
}

// The seeded fixture: the one merchant carrying a rate history resolves to
// 180bps across its whole seeded transaction window and 165bps afterwards.
// Skipped on a database that has not been seeded.
func TestEffectiveMdrBpsAt_SeededScheduleFixture(t *testing.T) {
	pool := mustPool(t)
	ctx := context.Background()

	var merchantID uuid.UUID
	err := pool.QueryRow(ctx, `
		SELECT id FROM merchants WHERE display_name = 'Beta Digital Services'
	`).Scan(&merchantID)
	if err != nil {
		t.Skipf("seeded fixture not present (run `npm run seed`): %v", err)
	}

	schedules := loadSchedules(t, pool, merchantID)
	if len(schedules) != 2 {
		t.Skipf("seeded fixture has %d schedule rows, expected 2 (run `npm run seed`)", len(schedules))
	}

	seedWindow := time.Date(2026, 9, 1, 12, 0, 0, 0, time.UTC)
	if got := EffectiveMdrBpsAt(schedules, seedWindow, 180); got != 180 {
		t.Errorf("inside the seeded transaction window: EffectiveMdrBpsAt = %d, want 180", got)
	}
	afterCutover := time.Date(2026, 9, 10, 0, 0, 0, 0, time.UTC)
	if got := EffectiveMdrBpsAt(schedules, afterCutover, 180); got != 165 {
		t.Errorf("after the cutover: EffectiveMdrBpsAt = %d, want 165", got)
	}
}

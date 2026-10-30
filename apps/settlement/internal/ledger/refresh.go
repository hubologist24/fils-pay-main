package ledger

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/filspay/settlement/internal/money"
)

// RefreshBalanceCache recomputes each merchant's cached balance from the
// settled position and overwrites merchant_balances in one transaction.
func RefreshBalanceCache(ctx context.Context, db *pgxpool.Pool) (map[uuid.UUID]RebuildDiff, error) {
	tx, err := db.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("ledger: RefreshBalanceCache: begin: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	rows, err := tx.Query(ctx, `
		SELECT DISTINCT merchant_id FROM (
			SELECT merchant_id FROM merchant_payable_position
			UNION
			SELECT merchant_id FROM merchant_balances
		) merchants
	`)
	if err != nil {
		return nil, fmt.Errorf("ledger: RefreshBalanceCache: select merchant ids: %w", err)
	}

	var merchantIDs []uuid.UUID
	for rows.Next() {
		var id uuid.UUID
		if err := rows.Scan(&id); err != nil {
			rows.Close()
			return nil, fmt.Errorf("ledger: RefreshBalanceCache: scan merchant id: %w", err)
		}
		merchantIDs = append(merchantIDs, id)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("ledger: RefreshBalanceCache: iterate merchant ids: %w", err)
	}
	rows.Close()

	diffs := make(map[uuid.UUID]RebuildDiff, len(merchantIDs))

	for _, merchantID := range merchantIDs {
		var cachedBefore int64
		err := tx.QueryRow(ctx, `
			SELECT COALESCE(cached_payable_fils, 0) FROM merchant_balances WHERE merchant_id = $1
		`, merchantID).Scan(&cachedBefore)
		if err != nil && !errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("ledger: RefreshBalanceCache: read cached balance for %s: %w", merchantID, err)
		}

		var rebuilt int64
		err = tx.QueryRow(ctx, `
			SELECT COALESCE(payable_fils, 0) FROM merchant_payable_position WHERE merchant_id = $1
		`, merchantID).Scan(&rebuilt)
		if err != nil && !errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("ledger: RefreshBalanceCache: recompute balance for %s: %w", merchantID, err)
		}

		_, err = tx.Exec(ctx, `
			INSERT INTO merchant_balances (merchant_id, cached_payable_fils, updated_at)
			VALUES ($1, $2, now())
			ON CONFLICT (merchant_id) DO UPDATE
			  SET cached_payable_fils = $2, updated_at = now()
		`, merchantID, rebuilt)
		if err != nil {
			return nil, fmt.Errorf("ledger: RefreshBalanceCache: write rebuilt balance for %s: %w", merchantID, err)
		}

		diffs[merchantID] = RebuildDiff{
			MerchantID:   merchantID,
			CachedBefore: money.Fils(cachedBefore),
			Rebuilt:      money.Fils(rebuilt),
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("ledger: RefreshBalanceCache: commit: %w", err)
	}

	return diffs, nil
}

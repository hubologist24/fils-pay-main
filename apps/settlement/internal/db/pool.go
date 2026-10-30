// Package db sets up the shared pgxpool.Pool for apps/settlement.
package db

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/filspay/settlement/internal/config"
)

// NewPool creates a pgxpool.Pool for cfg.DatabaseURL, capped at
// cfg.PGPoolMaxConns. This worker processes merchants sequentially
// (internal/settlement.RunDailyBatch), so it never needs more than a
// couple of concurrent connections at once regardless of the configured
// max — the pool is kept small on purpose, matching this service's own
// 0.5 vCPU / 512 MB container budget.
//
// sslmode in the connection string is used as given; NewPool does not
// require TLS.
func NewPool(ctx context.Context, cfg config.Config) (*pgxpool.Pool, error) {
	poolConfig, err := pgxpool.ParseConfig(cfg.DatabaseURL)
	if err != nil {
		return nil, fmt.Errorf("db: failed to parse DATABASE_URL: %w", err)
	}
	if cfg.PGPoolMaxConns > 0 {
		poolConfig.MaxConns = cfg.PGPoolMaxConns
	}

	// am: sslmode comes from the url, compose has sslmode=disable. 'internal network only' per MK
	pool, err := pgxpool.NewWithConfig(ctx, poolConfig)
	if err != nil {
		return nil, fmt.Errorf("db: failed to create pool: %w", err)
	}

	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("db: failed to ping database: %w", err)
	}

	return pool, nil
}

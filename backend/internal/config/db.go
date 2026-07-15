package config

import (
	"database/sql"
	"fmt"
	"log/slog"
	"time"

	_ "github.com/lib/pq" // PostgreSQL driver
)

// NewDB creates a PostgreSQL connection pool from the configuration.
// Uses lib/pq driver with sensible connection pool limits for MVP.
// For full version, add PgBouncer or switch to pgxpool.
func NewDB(cfg *Config) (*sql.DB, error) {
	slog.Info("connecting to database",
		"host", extractHost(cfg.DatabaseURL),
	)

	db, err := sql.Open("postgres", cfg.DatabaseURL)
	if err != nil {
		return nil, fmt.Errorf("database open failed: %w", err)
	}

	// Connection pool configuration
	// MVP values: single instance, moderate concurrency
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(10)
	db.SetConnMaxLifetime(5 * time.Minute)
	db.SetConnMaxIdleTime(1 * time.Minute)

	// Verify connectivity
	if err := db.Ping(); err != nil {
		db.Close()
		return nil, fmt.Errorf("database ping failed: %w", err)
	}

	// Log pool stats
	stats := db.Stats()
	slog.Info("database connected",
		"max_open_conns", 25,
		"open_conns", stats.OpenConnections,
		"in_use", stats.InUse,
		"idle", stats.Idle,
	)

	return db, nil
}

// extractHost extracts a human-readable host identifier from the connection URL
// without exposing credentials in logs.
func extractHost(databaseURL string) string {
	// Simple extraction: find text between @ and /
	start := 0
	for i := len(databaseURL) - 1; i >= 0; i-- {
		if databaseURL[i] == '@' {
			start = i + 1
			break
		}
	}
	end := len(databaseURL)
	for i := start; i < len(databaseURL); i++ {
		if databaseURL[i] == '/' || databaseURL[i] == '?' {
			end = i
			break
		}
	}
	if start < end {
		return databaseURL[start:end]
	}
	return "unknown"
}

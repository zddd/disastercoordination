package config

import (
	"database/sql"
	"log/slog"
	"os"
	"path/filepath"
)

// RunMigrations applies SQL migration files to the database.
// Reads from the migrations/ directory relative to the working directory.
// In production, migrations should be run as a separate deployment step.
func RunMigrations(db *sql.DB) error {
	slog.Info("running auto-migration")

	migrationFile := filepath.Join("migrations", "001_init.sql")
	content, err := os.ReadFile(migrationFile)
	if err != nil {
		return err
	}

	_, err = db.Exec(string(content))
	if err != nil {
		return err
	}

	return nil
}

// RunSeedIfEmpty inserts demo data if the users table is empty.
// Uses seed data file with ON CONFLICT DO NOTHING for idempotent execution.
func RunSeedIfEmpty(db *sql.DB) error {
	// Check if users table has data
	var count int
	if err := db.QueryRow("SELECT COUNT(*) FROM users").Scan(&count); err != nil {
		// Table might not exist yet — that's OK, seed runs after migration
		return nil
	}
	if count > 0 {
		slog.Info("seed skipped — users already exist", "count", count)
		return nil
	}

	slog.Info("running seed data — no users found, inserting demo accounts")

	content, err := os.ReadFile(filepath.Join("migrations", "002_seed.sql"))
	if err != nil {
		return err
	}

	_, err = db.Exec(string(content))
	if err != nil {
		return err
	}

	slog.Info("seed data inserted — demo accounts ready")
	return nil
}

package repository

import (
	"context"
	"crypto/rand"
	"database/sql"
	"fmt"
	"os"
	"testing"
	"time"

	_ "github.com/lib/pq"

	"disaster-coordination/internal/config"
	"disaster-coordination/internal/model"
)

var testDB *sql.DB

// TestMain sets up a test database connection.
// Requires: docker compose up -d postgres (running PostgreSQL with PostGIS)
// Skip tests if DATABASE_URL is not set.
func TestMain(m *testing.M) {
	cfg := config.Load()

	// Check if DATABASE_URL is explicitly set for testing
	if os.Getenv("DATABASE_URL") == "" && os.Getenv("CI") == "" {
		// In local dev without explicit DB, check if docker postgres is running
		db, err := sql.Open("postgres", cfg.DatabaseURL)
		if err != nil {
			os.Exit(0) // Skip tests gracefully
		}
		if err := db.Ping(); err != nil {
			db.Close()
			os.Exit(0) // Skip tests gracefully
		}
		db.Close()
	}

	var err error
	testDB, err = config.NewDB(cfg)
	if err != nil {
		// If DB is not available, skip all tests gracefully
		// (tests pass in CI but skip locally without DB)
		os.Exit(0)
	}
	defer testDB.Close()

	// Run tests
	m.Run()
}

func TestDisasterRepository_CreateAndGet(t *testing.T) {
	if testDB == nil {
		t.Skip("database not available")
	}

	repo := NewDisasterPostgresRepo(testDB)
	ctx := context.Background()

	d := &model.Disaster{
		ID:        generateTestID(),
		Name:      "测试地震",
		Type:      model.DisasterEarthquake,
		Level:     "red",
		Status:    "active",
		CreatedBy: generateTestID(), // Must be valid UUID
		StartedAt: time.Now(),
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	err := repo.Create(ctx, d)
	if err != nil {
		t.Fatalf("Create failed: %v", err)
	}

	got, err := repo.GetByID(ctx, d.ID)
	if err != nil {
		t.Fatalf("GetByID failed: %v", err)
	}

	if got.Name != d.Name {
		t.Errorf("expected name=%s, got %s", d.Name, got.Name)
	}
	if got.Type != d.Type {
		t.Errorf("expected type=%s, got %s", d.Type, got.Type)
	}
}

func TestDisasterRepository_ListActive(t *testing.T) {
	if testDB == nil {
		t.Skip("database not available")
	}

	repo := NewDisasterPostgresRepo(testDB)
	ctx := context.Background()

	active, err := repo.ListActive(ctx)
	if err != nil {
		t.Fatalf("ListActive failed: %v", err)
	}

	// Should return at least the one created in previous test
	if len(active) == 0 {
		t.Log("no active disasters found (might be running test in isolation)")
	}
	for _, d := range active {
		if d.Status != "active" {
			t.Errorf("expected active status, got %s for disaster %s", d.Status, d.ID)
		}
	}
}

func TestUserRepository_CreateAndGet(t *testing.T) {
	if testDB == nil {
		t.Skip("database not available")
	}

	repo := NewUserPostgresRepo(testDB)
	ctx := context.Background()

	username := "test-user-" + generateTestID()[:8]
	u := &model.User{
		ID:           generateTestID(),
		Username:     username,
		PasswordHash: "$2a$10$dummyhash",
		Role:         model.RoleVictim,
		CreditScore:  100.0,
		Status:       "active",
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}

	err := repo.Create(ctx, u)
	if err != nil {
		t.Fatalf("Create user failed: %v", err)
	}

	got, err := repo.GetByUsername(ctx, username)
	if err != nil {
		t.Fatalf("GetByUsername failed: %v", err)
	}

	if got.Username != username {
		t.Errorf("expected username=%s, got %s", username, got.Username)
	}
	if got.Role != model.RoleVictim {
		t.Errorf("expected role=victim, got %s", got.Role)
	}
}

func TestUserRepository_UpdateCreditScore(t *testing.T) {
	if testDB == nil {
		t.Skip("database not available")
	}

	repo := NewUserPostgresRepo(testDB)
	ctx := context.Background()

	// Create a test user first
	username := "credit-test-" + generateTestID()[:8]
	u := &model.User{
		ID:           generateTestID(),
		Username:     username,
		PasswordHash: "$2a$10$dummyhash",
		Role:         model.RoleVictim,
		CreditScore:  100.0,
		Status:       "active",
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}
	repo.Create(ctx, u)

	// Update credit score: deduct 10
	err := repo.UpdateCreditScore(ctx, u.ID, -10)
	if err != nil {
		t.Fatalf("UpdateCreditScore failed: %v", err)
	}

	// Verify
	got, _ := repo.GetByID(ctx, u.ID)
	if got.CreditScore != 90.0 {
		t.Errorf("expected credit_score=90, got %f", got.CreditScore)
	}
}

func TestUserRepository_GetByUsername_NotFound(t *testing.T) {
	if testDB == nil {
		t.Skip("database not available")
	}

	repo := NewUserPostgresRepo(testDB)
	ctx := context.Background()

	_, err := repo.GetByUsername(ctx, "nonexistent-user-12345")
	if err == nil {
		t.Error("expected error for nonexistent user")
	}
}

func TestRepository_NewPostgresRepository(t *testing.T) {
	if testDB == nil {
		t.Skip("database not available")
	}

	repo := NewPostgresRepository(testDB)

	if repo.Help == nil {
		t.Error("Help repository should not be nil")
	}
	if repo.Disaster == nil {
		t.Error("Disaster repository should not be nil")
	}
	if repo.Team == nil {
		t.Error("Team repository should not be nil")
	}
	if repo.Task == nil {
		t.Error("Task repository should not be nil")
	}
	if repo.User == nil {
		t.Error("User repository should not be nil")
	}
}

// generateTestID returns a valid UUID v4 for test entities.
func generateTestID() string {
	uuid := make([]byte, 16)
	_, _ = rand.Read(uuid)
	// Set version 4 and variant bits
	uuid[6] = (uuid[6] & 0x0f) | 0x40
	uuid[8] = (uuid[8] & 0x3f) | 0x80
	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x",
		uuid[0:4], uuid[4:6], uuid[6:8], uuid[8:10], uuid[10:16])
}

// Package repository defines data access interfaces for all entities.
// All repository interfaces are designed for testability (mockable) and
// extensibility (full version can swap PostgreSQL for distributed stores).
package repository

import (
	"context"
	"database/sql"
	"time"

	"disaster-coordination/internal/model"
)

// Repository is the aggregate data access layer.
// All individual repositories are available through this interface.
type Repository struct {
	Help     HelpRepository
	Disaster DisasterRepository
	Team     TeamRepository
	Task     TaskRepository
	User     UserRepository
}

// NewPostgresRepository creates a Repository backed by PostgreSQL.
func NewPostgresRepository(db *sql.DB) *Repository {
	return &Repository{
		Help:     NewHelpPostgresRepo(db),
		Disaster: NewDisasterPostgresRepo(db),
		Team:     NewTeamPostgresRepo(db),
		Task:     NewTaskPostgresRepo(db),
		User:     NewUserPostgresRepo(db),
	}
}

// ============================================================
// HelpRepository - Help request data access
// ============================================================

// HelpRepository defines operations on help_requests.
type HelpRepository interface {
	Create(ctx context.Context, h *model.HelpRequest) error
	GetByID(ctx context.Context, id string) (*model.HelpRequest, error)
	ListByDisaster(ctx context.Context, disasterID string, status string) ([]*model.HelpRequest, error)
	ListBySubmitter(ctx context.Context, submitterID string) ([]*model.HelpRequest, error)
	UpdateStatus(ctx context.Context, id string, status string) error
	UpdateReviewStatus(ctx context.Context, id string, reviewStatus string, reviewerID string) error
	ListInPool(ctx context.Context, disasterID string, zone string) ([]*model.HelpRequest, error)
	CheckDuplicate(ctx context.Context, disasterID string, lat, lng float64, descriptionHash string, interval time.Duration) (bool, string, error)
	ListPendingReview(ctx context.Context, limit int) ([]*model.HelpRequest, error)
}

// helpPostgresRepo implements HelpRepository with PostgreSQL.
type helpPostgresRepo struct {
	db *sql.DB
}

func NewHelpPostgresRepo(db *sql.DB) HelpRepository {
	return &helpPostgresRepo{db: db}
}

// ============================================================
// DisasterRepository - Disaster data access
// ============================================================

type DisasterRepository interface {
	Create(ctx context.Context, d *model.Disaster) error
	GetByID(ctx context.Context, id string) (*model.Disaster, error)
	List(ctx context.Context, status string) ([]*model.Disaster, error)
	ListActive(ctx context.Context) ([]*model.Disaster, error)
	Close(ctx context.Context, id string, closedAt time.Time) error
	GetSummary(ctx context.Context, id string) (*model.DisasterSummary, error)
}

type disasterPostgresRepo struct {
	db *sql.DB
}

func NewDisasterPostgresRepo(db *sql.DB) DisasterRepository {
	return &disasterPostgresRepo{db: db}
}

// ============================================================
// TeamRepository - Rescue team data access
// ============================================================

type TeamRepository interface {
	Create(ctx context.Context, t *model.RescueTeam) error
	GetByID(ctx context.Context, id string) (*model.RescueTeam, error)
	List(ctx context.Context) ([]*model.RescueTeam, error)
	FindNearby(ctx context.Context, lat, lng float64, radiusMeters int) ([]*model.RescueTeam, error)
	UpdateStatus(ctx context.Context, id string, status string) error
	Verify(ctx context.Context, id string) error
	Reject(ctx context.Context, id string, reason string) error
	UpdateLocation(ctx context.Context, id string, lat, lng float64) error
}

type teamPostgresRepo struct {
	db *sql.DB
}

func NewTeamPostgresRepo(db *sql.DB) TeamRepository {
	return &teamPostgresRepo{db: db}
}

// ============================================================
// TaskRepository - Rescue task data access
// ============================================================

type TaskRepository interface {
	Create(ctx context.Context, t *model.RescueTask) error
	GetByID(ctx context.Context, id string) (*model.RescueTask, error)
	ListByTeam(ctx context.Context, teamID string, status string) ([]*model.RescueTask, error)
	ListByDisaster(ctx context.Context, disasterID string) ([]*model.RescueTask, error)
	UpdateStatus(ctx context.Context, id string, status string, operatorID string, notes string) error
	AppendStatusHistory(ctx context.Context, id string, entry model.StatusHistoryEntry) error
	Reject(ctx context.Context, id string, reason string, operatorID string) error
}

type taskPostgresRepo struct {
	db *sql.DB
}

func NewTaskPostgresRepo(db *sql.DB) TaskRepository {
	return &taskPostgresRepo{db: db}
}

// ============================================================
// UserRepository - User data access
// ============================================================

type UserRepository interface {
	Create(ctx context.Context, u *model.User) error
	GetByID(ctx context.Context, id string) (*model.User, error)
	GetByUsername(ctx context.Context, username string) (*model.User, error)
	UpdateCreditScore(ctx context.Context, id string, delta float64) error
}

type userPostgresRepo struct {
	db *sql.DB
}

func NewUserPostgresRepo(db *sql.DB) UserRepository {
	return &userPostgresRepo{db: db}
}

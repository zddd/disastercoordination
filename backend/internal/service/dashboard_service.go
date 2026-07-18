package service

import (
	"context"
	"log/slog"

	"disaster-coordination/internal/repository"
)

// DashboardStats aggregates statistics for the admin dashboard overview.
// Provides a single endpoint that the frontend calls instead of multiple separate queries,
// reducing network overhead and ensuring consistent data snapshots.
type DashboardStats struct {
	// Disaster totals
	ActiveDisasters   int `json:"active_disasters"`
	TotalDisasters    int `json:"total_disasters"`

	// Help request totals per active disaster
	TotalHelps    int `json:"total_helps"`
	ReviewedHelps int `json:"reviewed_helps"`
	PendingHelps  int `json:"pending_helps"`
	CompletedHelps int `json:"completed_helps"`
	CriticalHelps int `json:"critical_helps"`
	NormalHelps   int `json:"normal_helps"`
	MildHelps     int `json:"mild_helps"`

	// Rescue team statistics
	TotalTeams        int `json:"total_teams"`
	RegisteredTeams   int `json:"registered_teams"`
	CivilTeams        int `json:"civil_teams"`
	VerifiedTeams     int `json:"verified_teams"`
	PendingTeams      int `json:"pending_teams"`
	RejectedTeams     int `json:"rejected_teams"`

	// Task statistics
	TotalTasks       int `json:"total_tasks"`
	CompletedTasks   int `json:"completed_tasks"`
	InProgressTasks  int `json:"in_progress_tasks"`
}

// DashboardService defines the dashboard aggregation service interface.
type DashboardService interface {
	GetStats(ctx context.Context) (*DashboardStats, error)
}

type dashboardService struct {
	helpRepo     repository.HelpRepository
	disasterRepo repository.DisasterRepository
	teamRepo     repository.TeamRepository
	taskRepo     repository.TaskRepository
}

// NewDashboardService creates a DashboardService backed by repositories.
func NewDashboardService(
	helpRepo repository.HelpRepository,
	disasterRepo repository.DisasterRepository,
	teamRepo repository.TeamRepository,
	taskRepo repository.TaskRepository,
) DashboardService {
	return &dashboardService{
		helpRepo:     helpRepo,
		disasterRepo: disasterRepo,
		teamRepo:     teamRepo,
		taskRepo:     taskRepo,
	}
}

// GetStats aggregates all dashboard statistics from the database.
// Each section queries its own repository and we build a unified response.
func (s *dashboardService) GetStats(ctx context.Context) (*DashboardStats, error) {
	slog.DebugContext(ctx, "aggregating dashboard statistics")

	stats := &DashboardStats{}

	// ---- Disaster stats ----
	activeDisasters, err := s.disasterRepo.ListActive(ctx)
	if err != nil {
		slog.ErrorContext(ctx, "failed to list active disasters for dashboard", "error", err)
	} else {
		stats.ActiveDisasters = len(activeDisasters)
	}

	allDisasters, err := s.disasterRepo.List(ctx, "")
	if err != nil {
		slog.ErrorContext(ctx, "failed to list all disasters for dashboard", "error", err)
	} else {
		stats.TotalDisasters = len(allDisasters)
	}

	// ---- Help request stats (only for active disasters) ----
	// Aggregate across all active disasters
	for _, d := range activeDisasters {
		helps, err := s.helpRepo.ListByDisaster(ctx, d.ID, "")
		if err != nil {
			slog.WarnContext(ctx, "failed to list helps for disaster", "disaster_id", d.ID, "error", err)
			continue
		}
		for _, h := range helps {
			stats.TotalHelps++
			// Review status breakdown
			if h.ReviewStatus == "approved" {
				stats.ReviewedHelps++
			} else if h.ReviewStatus == "pending" {
				stats.PendingHelps++
			}
			// Completed helps count
			if h.Status == "completed" {
				stats.CompletedHelps++
			}
			switch h.Urgency {
			case "critical":
				stats.CriticalHelps++
			case "normal":
				stats.NormalHelps++
			default:
				stats.MildHelps++
			}
		}
	}

	// ---- Rescue team stats ----
	teams, err := s.teamRepo.List(ctx)
	if err != nil {
		slog.ErrorContext(ctx, "failed to list teams for dashboard", "error", err)
	} else {
		for _, t := range teams {
			stats.TotalTeams++
			switch t.Type {
			case "registered":
				stats.RegisteredTeams++
			case "civil":
				stats.CivilTeams++
			}
			if t.Verified {
				stats.VerifiedTeams++
			}
			switch t.Status {
			case "pending":
				stats.PendingTeams++
			case "rejected":
				stats.RejectedTeams++
			}
		}
	}

	// ---- Task stats (for active disasters) ----
	for _, d := range activeDisasters {
		tasks, err := s.taskRepo.ListByDisaster(ctx, d.ID)
		if err != nil {
			slog.WarnContext(ctx, "failed to list tasks for disaster", "disaster_id", d.ID, "error", err)
			continue
		}
		for _, t := range tasks {
			stats.TotalTasks++
			switch t.Status {
			case "completed":
				stats.CompletedTasks++
			default:
				// assigned, accepted, en_route, arrived, rescuing are all in-progress
				stats.InProgressTasks++
			}
		}
	}

	slog.DebugContext(ctx, "dashboard statistics aggregated",
		"total_helps", stats.TotalHelps,
		"total_teams", stats.TotalTeams,
		"total_tasks", stats.TotalTasks,
		"active_disasters", stats.ActiveDisasters,
	)

	return stats, nil
}

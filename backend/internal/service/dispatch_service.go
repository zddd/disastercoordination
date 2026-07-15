package service

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/google/uuid"

	"disaster-coordination/internal/model"
	"disaster-coordination/internal/repository"
)

// DispatchService defines operations for the rescue dispatch workflow.
// In full version (T13), SuggestTeams will be implemented with algorithmic matching.
// For MVP, dispatch is manual — commanders select teams from the list.
type DispatchService interface {
	// GetPool returns the dispatch pool (approved helps waiting for assignment).
	GetPool(ctx context.Context, disasterID string) ([]PoolItem, error)

	// Assign creates a rescue task by assigning a help request to a team.
	Assign(ctx context.Context, helpID, teamID, commanderID string) (*model.RescueTask, error)

	// BatchAssign creates rescue tasks for multiple help requests assigned to the same team.
	BatchAssign(ctx context.Context, helpIDs []string, teamID, commanderID string) ([]*model.RescueTask, error)

	// SuggestTeams returns recommended teams for a help request.
	// MVP: returns empty slice. Full version (T13): implements scoring algorithm.
	SuggestTeams(ctx context.Context, helpID string) ([]SuggestedTeam, error)
}

// PoolItem represents a help request in the dispatch pool with nearby team suggestions.
type PoolItem struct {
	HelpID         string          `json:"help_id"`
	DisasterID     string          `json:"disaster_id"`
	Category       string          `json:"category"`
	Urgency        string          `json:"urgency"`
	Description    string          `json:"description"`
	AffectedCount  int             `json:"affected_count"`
	Lat            float64         `json:"lat"`
	Lng            float64         `json:"lng"`
	WaitingMinutes float64         `json:"waiting_minutes"`
	IsIsolated     bool            `json:"is_isolated"`
	NearbyTeams    []SuggestedTeam `json:"nearby_teams"`
}

// SuggestedTeam represents a team recommendation with distance and availability.
type SuggestedTeam struct {
	TeamID     string  `json:"team_id"`
	Name       string  `json:"name"`
	DistanceM  float64 `json:"distance_m"`
	Available  bool    `json:"available"`
	ActiveTasks int    `json:"active_tasks"`
}

type dispatchService struct {
	helpRepo  repository.HelpRepository
	taskRepo  repository.TaskRepository
	teamRepo  repository.TeamRepository
}

func NewDispatchService(helpRepo repository.HelpRepository, taskRepo repository.TaskRepository, teamRepo repository.TeamRepository) DispatchService {
	return &dispatchService{helpRepo: helpRepo, taskRepo: taskRepo, teamRepo: teamRepo}
}

// GetPool returns help requests in the dispatch pool, ordered by urgency and waiting time.
// Each item includes nearby team suggestions via PostGIS spatial query.
func (s *dispatchService) GetPool(ctx context.Context, disasterID string) ([]PoolItem, error) {
	slog.InfoContext(ctx, "fetching dispatch pool", "disaster_id", disasterID)

	helps, err := s.helpRepo.ListInPool(ctx, disasterID, "")
	if err != nil {
		return nil, fmt.Errorf("fetch pool: %w", err)
	}

	pool := make([]PoolItem, 0, len(helps))
	for _, h := range helps {
		// Find nearby rescue teams (within 50km for MVP)
		teams, err := s.teamRepo.FindNearby(ctx, h.OffsetLat, h.OffsetLng, 50000)
		if err != nil {
			slog.Warn("failed to find nearby teams", "help_id", h.ID, "error", err)
			teams = nil // Continue without nearby teams
		}

		nearbyTeams := make([]SuggestedTeam, 0, len(teams))
		for _, t := range teams {
			// Count active tasks for this team to determine availability
			activeTasks, _ := s.taskRepo.ListByTeam(ctx, t.ID, "")
			inProgress := 0
			for _, task := range activeTasks {
				if task.Status != model.TaskStatusCompleted && task.Status != model.TaskStatusUnable {
					inProgress++
				}
			}

			nearbyTeams = append(nearbyTeams, SuggestedTeam{
				TeamID:      t.ID,
				Name:        t.Name,
				DistanceM:   t.CurrentLat, // FindNearby stores distance in CurrentLat for now
				Available:   inProgress < 5, // MVP threshold: max 5 concurrent
				ActiveTasks: inProgress,
			})
		}

		pool = append(pool, PoolItem{
			HelpID:         h.ID,
			DisasterID:     h.DisasterID,
			Category:       h.Category,
			Urgency:        h.Urgency,
			Description:    h.Description,
			AffectedCount:  h.AffectedCount,
			Lat:            h.OffsetLat,
			Lng:            h.OffsetLng,
			WaitingMinutes: time.Since(h.CreatedAt).Minutes(),
			IsIsolated:     h.IsIsolatedReport,
			NearbyTeams:    nearbyTeams,
		})
	}

	slog.InfoContext(ctx, "dispatch pool served",
		"disaster_id", disasterID,
		"pool_size", len(pool),
	)

	return pool, nil
}

// Assign creates a rescue task linking a help request to a rescue team.
// The commander manually selects the team from the pool.
func (s *dispatchService) Assign(ctx context.Context, helpID, teamID, commanderID string) (*model.RescueTask, error) {
	slog.InfoContext(ctx, "assigning task",
		"help_id", helpID,
		"team_id", teamID,
		"commander", commanderID,
	)

	// Verify help request exists and is in pool
	help, err := s.helpRepo.GetByID(ctx, helpID)
	if err != nil {
		return nil, fmt.Errorf("help request not found: %w", err)
	}
	if help.Status != "in_pool" {
		return nil, fmt.Errorf("help is not in dispatch pool (status=%s)", help.Status)
	}

	// Verify team exists and is active
	team, err := s.teamRepo.GetByID(ctx, teamID)
	if err != nil {
		return nil, fmt.Errorf("team not found: %w", err)
	}
	if team.Status != "active" {
		return nil, fmt.Errorf("team is not active (status=%s)", team.Status)
	}

	// Create the task
	now := time.Now()
	task := &model.RescueTask{
		ID:            uuid.New().String(),
		HelpRequestID: helpID,
		TeamID:        teamID,
		DisasterID:    help.DisasterID,
		Status:        model.TaskStatusAssigned,
		AssignedBy:    commanderID,
		StatusHistory: []model.StatusHistoryEntry{
			{Status: model.TaskStatusAssigned, Timestamp: now, OperatorID: commanderID},
		},
		CreatedAt: now,
		UpdatedAt: now,
	}

	if err := s.taskRepo.Create(ctx, task); err != nil {
		return nil, fmt.Errorf("create task failed: %w", err)
	}

	// Update help request status to assigned
	if err := s.helpRepo.UpdateStatus(ctx, helpID, "assigned"); err != nil {
		slog.Error("failed to update help status", "help_id", helpID, "error", err)
		// Non-blocking: task is created
	}

	slog.InfoContext(ctx, "task assigned",
		"task_id", task.ID,
		"help_id", helpID,
		"team_id", teamID,
		"team_name", team.Name,
	)

	return task, nil
}

// BatchAssign creates tasks for multiple help requests assigned to the same team.
func (s *dispatchService) BatchAssign(ctx context.Context, helpIDs []string, teamID, commanderID string) ([]*model.RescueTask, error) {
	slog.InfoContext(ctx, "batch assigning",
		"help_count", len(helpIDs),
		"team_id", teamID,
	)

	tasks := make([]*model.RescueTask, 0, len(helpIDs))
	for _, helpID := range helpIDs {
		task, err := s.Assign(ctx, helpID, teamID, commanderID)
		if err != nil {
			slog.Warn("batch assign failed for help", "help_id", helpID, "error", err)
			continue // Continue with remaining helps
		}
		tasks = append(tasks, task)
	}

	slog.InfoContext(ctx, "batch assign completed",
		"requested", len(helpIDs),
		"succeeded", len(tasks),
	)

	return tasks, nil
}

// SuggestTeams is a placeholder for the full version smart dispatch algorithm (T13).
// MVP returns an empty slice.
func (s *dispatchService) SuggestTeams(ctx context.Context, helpID string) ([]SuggestedTeam, error) {
	// TODO: Full version T13 — implement scoring algorithm based on:
	//   distance (ST_Distance), capability match (capabilities ∩ help category),
	//   load factor (in-progress tasks), and team performance history.
	//   score = w1*distance + w2*capability_match + w3*load_factor
	_ = helpID
	return nil, nil
}

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

// DisasterService defines operations for disaster lifecycle management.
type DisasterService interface {
	Create(ctx context.Context, req CreateDisasterRequest) (*model.Disaster, error)
	GetByID(ctx context.Context, id string) (*model.Disaster, error)
	List(ctx context.Context, status string) ([]*model.Disaster, error)
	ListActive(ctx context.Context) ([]*model.Disaster, error)
	Close(ctx context.Context, id string, operatorID string) (*model.DisasterSummary, error)
}

// CreateDisasterRequest is the input for creating a new disaster instance.
type CreateDisasterRequest struct {
	Name        string `json:"name"`
	Type        model.DisasterType `json:"type"`
	Level       string `json:"level"`
	Description string `json:"description,omitempty"`
	CreatedBy   string `json:"created_by"`
}

type disasterService struct {
	disasterRepo repository.DisasterRepository
	taskRepo     repository.TaskRepository
}

func NewDisasterService(disasterRepo repository.DisasterRepository, taskRepo repository.TaskRepository) DisasterService {
	return &disasterService{disasterRepo: disasterRepo, taskRepo: taskRepo}
}

func (s *disasterService) Create(ctx context.Context, req CreateDisasterRequest) (*model.Disaster, error) {
	slog.InfoContext(ctx, "creating disaster",
		"name", req.Name,
		"type", req.Type,
		"level", req.Level,
	)

	now := time.Now()
	d := &model.Disaster{
		ID:          uuid.New().String(),
		Name:        req.Name,
		Type:        req.Type,
		Level:       req.Level,
		Description: req.Description,
		Status:      "active",
		CreatedBy:   req.CreatedBy,
		StartedAt:   now,
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	if err := s.disasterRepo.Create(ctx, d); err != nil {
		return nil, fmt.Errorf("create disaster failed: %w", err)
	}

	slog.InfoContext(ctx, "disaster created", "id", d.ID, "name", d.Name)
	return d, nil
}

func (s *disasterService) GetByID(ctx context.Context, id string) (*model.Disaster, error) {
	return s.disasterRepo.GetByID(ctx, id)
}

func (s *disasterService) List(ctx context.Context, status string) ([]*model.Disaster, error) {
	return s.disasterRepo.List(ctx, status)
}

func (s *disasterService) ListActive(ctx context.Context) ([]*model.Disaster, error) {
	return s.disasterRepo.ListActive(ctx)
}

// Close terminates a disaster event and generates a summary report.
// Only the commander or admin can close a disaster.
// See design §12.7 for the full close procedure.
func (s *disasterService) Close(ctx context.Context, id string, operatorID string) (*model.DisasterSummary, error) {
	slog.InfoContext(ctx, "closing disaster", "id", id, "operator", operatorID)

	// Verify disaster exists and is active
	disaster, err := s.disasterRepo.GetByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("disaster not found: %w", err)
	}
	if disaster.Status != "active" {
		return nil, fmt.Errorf("disaster is already %s", disaster.Status)
	}

	// Check for in-progress tasks before closing
	tasks, err := s.taskRepo.ListByDisaster(ctx, id)
	if err != nil {
		slog.WarnContext(ctx, "failed to check tasks before close", "error", err)
		// Non-blocking: proceed with close anyway
	}
	hasActiveTasks := false
	for _, task := range tasks {
		if task.Status != model.TaskStatusCompleted && task.Status != model.TaskStatusUnable {
			hasActiveTasks = true
			break
		}
	}
	if hasActiveTasks {
		slog.WarnContext(ctx, "closing disaster with active tasks — forcing termination",
			"disaster_id", id,
			"total_tasks", len(tasks),
		)
	}

	// Close the disaster
	now := time.Now()
	if err := s.disasterRepo.Close(ctx, id, now); err != nil {
		return nil, fmt.Errorf("close disaster failed: %w", err)
	}

	// Generate summary report
	summary, err := s.disasterRepo.GetSummary(ctx, id)
	if err != nil {
		slog.WarnContext(ctx, "failed to generate summary", "error", err)
	}

	slog.InfoContext(ctx, "disaster closed",
		"id", id,
		"total_helps", summary.TotalHelps,
		"completed_tasks", summary.CompletedTasks,
	)

	return summary, nil
}

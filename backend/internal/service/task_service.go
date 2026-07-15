package service

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"disaster-coordination/internal/model"
	"disaster-coordination/internal/repository"
)

// TaskService defines operations for rescue task lifecycle management.
// Implements the task state machine defined in model/task.go (design §3.3).
type TaskService interface {
	// GetByID returns task details.
	GetByID(ctx context.Context, taskID string) (*model.RescueTask, error)

	// ListMine returns tasks assigned to a specific team.
	ListMine(ctx context.Context, teamID string, status string) ([]*model.RescueTask, error)

	// UpdateStatus transitions the task to a new state following the state machine rules.
	UpdateStatus(ctx context.Context, taskID, newStatus, operatorID, notes string) (*model.RescueTask, error)

	// Reject marks a task as rejected by the team with a reason.
	Reject(ctx context.Context, taskID, teamID, reason string) error

	// GetByHelp returns tasks for a specific help request.
	GetByHelp(ctx context.Context, helpID string) ([]*model.RescueTask, error)
}

type taskService struct {
	taskRepo repository.TaskRepository
	helpRepo repository.HelpRepository
}

func NewTaskService(taskRepo repository.TaskRepository, helpRepo repository.HelpRepository) TaskService {
	return &taskService{taskRepo: taskRepo, helpRepo: helpRepo}
}

func (s *taskService) GetByID(ctx context.Context, taskID string) (*model.RescueTask, error) {
	task, err := s.taskRepo.GetByID(ctx, taskID)
	if err != nil {
		return nil, fmt.Errorf("task not found: %w", err)
	}
	return task, nil
}

func (s *taskService) ListMine(ctx context.Context, teamID string, status string) ([]*model.RescueTask, error) {
	return s.taskRepo.ListByTeam(ctx, teamID, status)
}

// UpdateStatus transitions the task to a new state.
// Validates the transition against the task state machine (model.IsValidTransition).
// Records the transition in status_history JSONB for audit trail.
func (s *taskService) UpdateStatus(ctx context.Context, taskID, newStatus, operatorID, notes string) (*model.RescueTask, error) {
	slog.InfoContext(ctx, "updating task status",
		"task_id", taskID,
		"new_status", newStatus,
		"operator", operatorID,
	)

	// Get current task
	task, err := s.taskRepo.GetByID(ctx, taskID)
	if err != nil {
		return nil, fmt.Errorf("task not found: %w", err)
	}

	// Validate state transition
	if !model.IsValidTransition(task.Status, newStatus) {
		return nil, fmt.Errorf("invalid transition: %s → %s", task.Status, newStatus)
	}

	// Update the task status
	if err := s.taskRepo.UpdateStatus(ctx, taskID, newStatus, operatorID, notes); err != nil {
		return nil, fmt.Errorf("update status failed: %w", err)
	}

	// Append to status history
	entry := model.StatusHistoryEntry{
		Status:     newStatus,
		Timestamp:  time.Now(),
		OperatorID: operatorID,
		Notes:      notes,
	}
	if err := s.taskRepo.AppendStatusHistory(ctx, taskID, entry); err != nil {
		slog.Warn("failed to append status history", "task_id", taskID, "error", err)
	}

	// Set timestamps for special states
	if newStatus == model.TaskStatusAccepted {
		now := time.Now()
		task.AcceptedAt = &now
	} else if newStatus == model.TaskStatusCompleted || newStatus == model.TaskStatusUnable {
		now := time.Now()
		task.CompletedAt = &now
	}

	// Update help request status when task is completed
	if newStatus == model.TaskStatusCompleted {
		if err := s.helpRepo.UpdateStatus(ctx, task.HelpRequestID, "completed"); err != nil {
			slog.Warn("failed to update help status", "help_id", task.HelpRequestID, "error", err)
		}
	}

	slog.InfoContext(ctx, "task status updated",
		"task_id", taskID,
		"from", task.Status,
		"to", newStatus,
		"operator", operatorID,
	)

	// Refresh and return
	return s.taskRepo.GetByID(ctx, taskID)
}

// Reject allows a rescue team to reject an assigned task with a reason.
// The rejected task triggers re-allocation back to the dispatch pool.
func (s *taskService) Reject(ctx context.Context, taskID, teamID, reason string) error {
	slog.InfoContext(ctx, "rejecting task",
		"task_id", taskID,
		"team_id", teamID,
		"reason", reason,
	)

	task, err := s.taskRepo.GetByID(ctx, taskID)
	if err != nil {
		return fmt.Errorf("task not found: %w", err)
	}

	// Validate the team owns this task
	if task.TeamID != teamID {
		return fmt.Errorf("task does not belong to team %s", teamID)
	}

	// Validate task can be rejected (only assigned or accepted tasks)
	if task.Status != model.TaskStatusAssigned && task.Status != model.TaskStatusAccepted {
		return fmt.Errorf("cannot reject task in status %s", task.Status)
	}

	if err := s.taskRepo.Reject(ctx, taskID, reason, teamID); err != nil {
		return fmt.Errorf("reject failed: %w", err)
	}

	// Return help request to dispatch pool for re-assignment
	if err := s.helpRepo.UpdateStatus(ctx, task.HelpRequestID, "in_pool"); err != nil {
		slog.Warn("failed to return help to pool", "help_id", task.HelpRequestID, "error", err)
	}

	slog.InfoContext(ctx, "task rejected — returned to pool",
		"task_id", taskID,
		"help_id", task.HelpRequestID,
	)

	return nil
}

func (s *taskService) GetByHelp(ctx context.Context, helpID string) ([]*model.RescueTask, error) {
	// The task repo doesn't have ListByHelp, so we use the disaster repo to find tasks
	// via the disaster ID from the help request
	help, err := s.helpRepo.GetByID(ctx, helpID)
	if err != nil {
		return nil, fmt.Errorf("help not found: %w", err)
	}
	return s.taskRepo.ListByDisaster(ctx, help.DisasterID)
}

package service

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"disaster-coordination/internal/model"
	"disaster-coordination/internal/repository"
)

// ReviewService defines operations for the help request review workflow.
type ReviewService interface {
	GetQueue(ctx context.Context, limit int) ([]ReviewQueueItem, error)
	Approve(ctx context.Context, helpID string, reviewerID string) error
	Reject(ctx context.Context, helpID string, reviewerID string, reason string) error
	Merge(ctx context.Context, primaryID string, duplicateIDs []string, reviewerID string) error
}

// ReviewQueueItem represents a help request in the review queue with SLA info.
type ReviewQueueItem struct {
	HelpID         string  `json:"help_id"`
	DisasterID     string  `json:"disaster_id"`
	Category       string  `json:"category"`
	Urgency        string  `json:"urgency"`
	Description    string  `json:"description"`
	WaitingMinutes float64 `json:"waiting_minutes"` // Minutes since submission
	SLAMinutes     int     `json:"sla_minutes"`     // Remaining SLA time (may be negative for overdue)
	Status         string  `json:"status"`
	AIFlags        []string `json:"ai_flags,omitempty"` // AI pre-screening results
}

type reviewService struct {
	helpRepo repository.HelpRepository
	userRepo repository.UserRepository
}

func NewReviewService(helpRepo repository.HelpRepository, userRepo repository.UserRepository) ReviewService {
	return &reviewService{helpRepo: helpRepo, userRepo: userRepo}
}

// GetQueue retrieves the review queue sorted by urgency and waiting time.
// SLA markers: critical >5min → yellow warning, >10min → red alert.
// See design §3.2 for the full review flow.
func (s *reviewService) GetQueue(ctx context.Context, limit int) ([]ReviewQueueItem, error) {
	if limit <= 0 {
		limit = 50
	}

	helps, err := s.helpRepo.ListPendingReview(ctx, limit)
	if err != nil {
		return nil, fmt.Errorf("get review queue: %w", err)
	}

	queue := make([]ReviewQueueItem, 0, len(helps))
	for _, h := range helps {
		waitingMinutes := time.Since(h.CreatedAt).Minutes()
		slaMinutes := model.EstimatedReviewTime(h.Urgency)

		item := ReviewQueueItem{
			HelpID:         h.ID,
			DisasterID:     h.DisasterID,
			Category:       h.Category,
			Urgency:        h.Urgency,
			Description:    truncateString(h.Description, 100),
			WaitingMinutes: waitingMinutes,
			SLAMinutes:     slaMinutes,
			Status:         h.ReviewStatus,
		}

		// Log SLA breaches for observability
		if waitingMinutes > float64(slaMinutes) {
			slog.Warn("review SLA breached",
				"help_id", h.ID,
				"urgency", h.Urgency,
				"waiting_min", waitingMinutes,
				"sla_min", slaMinutes,
			)
		} else if waitingMinutes > float64(slaMinutes)*0.8 {
			slog.Debug("review SLA approaching",
				"help_id", h.ID,
				"urgency", h.Urgency,
				"waiting_min", waitingMinutes,
				"sla_min", slaMinutes,
			)
		}

		queue = append(queue, item)
	}

	slog.InfoContext(ctx, "review queue served",
		"queue_size", len(queue),
	)

	return queue, nil
}

// Approve approves a help request, moving it from pending_review to in_pool.
// The approved help becomes available in the dispatch pool for commanders.
func (s *reviewService) Approve(ctx context.Context, helpID string, reviewerID string) error {
	slog.InfoContext(ctx, "approving help request", "help_id", helpID, "reviewer", reviewerID)

	help, err := s.helpRepo.GetByID(ctx, helpID)
	if err != nil {
		return fmt.Errorf("help request not found: %w", err)
	}
	if help.ReviewStatus != "pending" && help.ReviewStatus != "ai_flagged" {
		return fmt.Errorf("help is already %s, cannot approve", help.ReviewStatus)
	}

	// Update review status to approved
	if err := s.helpRepo.UpdateReviewStatus(ctx, helpID, "approved", reviewerID); err != nil {
		return fmt.Errorf("approve failed: %w", err)
	}

	// Move status from pending_review to in_pool (ready for dispatch)
	if err := s.helpRepo.UpdateStatus(ctx, helpID, "in_pool"); err != nil {
		return fmt.Errorf("update status failed: %w", err)
	}

	slog.InfoContext(ctx, "help request approved", "help_id", helpID)
	return nil
}

// Reject rejects a help request and deducts submitter credit score.
// False/malicious submissions are penalized to maintain data quality.
// See design §5.3 for the credit score system.
func (s *reviewService) Reject(ctx context.Context, helpID string, reviewerID string, reason string) error {
	slog.InfoContext(ctx, "rejecting help request", "help_id", helpID, "reviewer", reviewerID, "reason", reason)

	help, err := s.helpRepo.GetByID(ctx, helpID)
	if err != nil {
		return fmt.Errorf("help request not found: %w", err)
	}

	if err := s.helpRepo.UpdateReviewStatus(ctx, helpID, "rejected", reviewerID); err != nil {
		return err
	}
	if err := s.helpRepo.UpdateStatus(ctx, helpID, "rejected"); err != nil {
		return err
	}

	// Deduct credit score from the submitter if authenticated
	if help.SubmitterID != "" {
		const rejectionPenalty = -10.0
		if err := s.userRepo.UpdateCreditScore(ctx, help.SubmitterID, rejectionPenalty); err != nil {
			slog.Warn("failed to update credit score", "user_id", help.SubmitterID, "error", err)
		} else {
			slog.Info("credit score deducted",
				"user_id", help.SubmitterID,
				"penalty", rejectionPenalty,
				"reason", reason,
			)
		}
	}

	slog.InfoContext(ctx, "help request rejected", "help_id", helpID)
	return nil
}

// Merge combines duplicate help requests into a single primary record.
// See design §3.2 and requirement §3.4 for the deduplication strategy.
func (s *reviewService) Merge(ctx context.Context, primaryID string, duplicateIDs []string, reviewerID string) error {
	slog.InfoContext(ctx, "merging help requests",
		"primary", primaryID,
		"duplicates", len(duplicateIDs),
		"reviewer", reviewerID,
	)

	// Mark duplicates as merged
	for _, dupID := range duplicateIDs {
		if dupID == primaryID {
			continue
		}
		if err := s.helpRepo.UpdateReviewStatus(ctx, dupID, "merged", reviewerID); err != nil {
			slog.Warn("failed to merge duplicate", "help_id", dupID, "error", err)
			continue
		}
		if err := s.helpRepo.UpdateStatus(ctx, dupID, "merged"); err != nil {
			slog.Warn("failed to update merged status", "help_id", dupID, "error", err)
		}
	}

	slog.InfoContext(ctx, "merge completed", "primary", primaryID, "merged_count", len(duplicateIDs))
	return nil
}

// truncateString truncates a string to maxLen characters for display purposes.
func truncateString(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen] + "..."
}

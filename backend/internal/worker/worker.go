package worker

import (
	"context"
	"log/slog"
	"time"

	"disaster-coordination/internal/repository"
)

// BackgroundWorker runs periodic maintenance tasks for the system.
// Includes timeout alerts, archival, and other scheduled jobs.
type BackgroundWorker struct {
	helpRepo     repository.HelpRepository
	disasterRepo repository.DisasterRepository
	stopCh       chan struct{}
}

// NewBackgroundWorker creates a new background worker.
func NewBackgroundWorker(helpRepo repository.HelpRepository, disasterRepo repository.DisasterRepository) *BackgroundWorker {
	return &BackgroundWorker{
		helpRepo:     helpRepo,
		disasterRepo: disasterRepo,
		stopCh:       make(chan struct{}),
	}
}

// Start begins all periodic jobs in separate goroutines.
func (w *BackgroundWorker) Start(ctx context.Context) {
	slog.InfoContext(ctx, "background worker started")

	// Timeout alert scanner: every 30s
	go w.runPeriodic(ctx, 30*time.Second, w.scanTimeoutAlerts, "timeout_scanner")

	// Archival scanner: every hour
	go w.runPeriodic(ctx, 1*time.Hour, w.scanArchival, "archival_scanner")
}

// Stop signals all periodic jobs to stop.
func (w *BackgroundWorker) Stop() {
	close(w.stopCh)
	slog.Info("background worker stopped")
}

func (w *BackgroundWorker) runPeriodic(ctx context.Context, interval time.Duration, fn func(context.Context), name string) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	// Run immediately on start
	fn(ctx)

	for {
		select {
		case <-w.stopCh:
			return
		case <-ticker.C:
			fn(ctx)
		}
	}
}

// scanTimeoutAlerts checks for help requests that have been in the dispatch pool
// longer than their SLA allows. Yellow warning at 10min, red alert at 15min.
// See design §12.6 for the timeout alert strategy.
func (w *BackgroundWorker) scanTimeoutAlerts(ctx context.Context) {
	if w.helpRepo == nil {
		return
	}

	// Query helps in dispatch pool
	helps, err := w.helpRepo.ListInPool(ctx, "", "")
	if err != nil {
		slog.Error("timeout scan failed", "error", err)
		return
	}

	for _, help := range helps {
		if help.ReviewStatus == "" {
			waitingMinutes := time.Since(help.CreatedAt).Minutes()

			if waitingMinutes >= 15 {
				slog.Warn("dispatch timeout — RED alert",
					"help_id", help.ID,
					"waiting_min", int(waitingMinutes),
					"urgency", help.Urgency,
				)
			} else if waitingMinutes >= 10 {
				slog.Warn("dispatch timeout — YELLOW warning",
					"help_id", help.ID,
					"waiting_min", int(waitingMinutes),
					"urgency", help.Urgency,
				)
			}
		}
	}
}

// scanArchival checks for closed disasters older than 30 days and archives them.
// See design §12.7 for archival policy.
func (w *BackgroundWorker) scanArchival(ctx context.Context) {
	if w.disasterRepo == nil {
		return
	}

	disasters, err := w.disasterRepo.List(ctx, "closed")
	if err != nil {
		slog.Error("archival scan failed", "error", err)
		return
	}

	for _, d := range disasters {
		if d.ClosedAt == nil {
			continue
		}
		daysSinceClose := time.Since(*d.ClosedAt).Hours() / 24
		if daysSinceClose > 30 {
			slog.Info("archiving disaster",
				"disaster_id", d.ID,
				"name", d.Name,
				"days_closed", int(daysSinceClose),
			)
			// In MVP this just logs; full version would set is_archived=true
			// and move data to archive tables.
		}
	}
}

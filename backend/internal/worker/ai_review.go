package worker

import (
	"context"
	"log/slog"
	"strings"
	"time"
	"unicode"

	"disaster-coordination/internal/model"
	"disaster-coordination/internal/repository"
)

// AIReviewWorker periodically scans pending help requests and applies
// deterministic rules to flag potentially problematic submissions.
//
// This is a rule-based system (not ML) for MVP — see design §3.2.
// Full version can replace with an ML-based classifier via the same interface.
type AIReviewWorker struct {
	helpRepo    repository.HelpRepository
	flagStore   storeAIFlag
	stopCh      chan struct{}
	pollInterval time.Duration
}

// storeAIFlag abstracts the storage of AI flags. In MVP this writes to review_ai_flags table.
type storeAIFlag interface {
	Create(ctx context.Context, helpID string, flagType string, confidence float64, detail string) error
}

// NewAIReviewWorker creates a new AI review worker.
// pollInterval controls how often the worker scans for new help requests (default: 30s).
func NewAIReviewWorker(helpRepo repository.HelpRepository, flagStore storeAIFlag, pollInterval time.Duration) *AIReviewWorker {
	if pollInterval <= 0 {
		pollInterval = 30 * time.Second
	}
	return &AIReviewWorker{
		helpRepo:     helpRepo,
		flagStore:    flagStore,
		stopCh:       make(chan struct{}),
		pollInterval: pollInterval,
	}
}

// Start begins the periodic review loop in a separate goroutine.
func (w *AIReviewWorker) Start(ctx context.Context) {
	slog.InfoContext(ctx, "AI review worker started",
		"interval", w.pollInterval.String(),
	)
	go w.run(ctx)
}

// Stop signals the worker to stop gracefully.
func (w *AIReviewWorker) Stop() {
	close(w.stopCh)
	slog.Info("AI review worker stopped")
}

func (w *AIReviewWorker) run(ctx context.Context) {
	ticker := time.NewTicker(w.pollInterval)
	defer ticker.Stop()

	// Run immediately on start
	w.scan(ctx)

	for {
		select {
		case <-w.stopCh:
			return
		case <-ticker.C:
			w.scan(ctx)
		}
	}
}

// scan polls the database for pending help requests and applies rules.
func (w *AIReviewWorker) scan(ctx context.Context) {
	helps, err := w.helpRepo.ListPendingReview(ctx, 20)
	if err != nil {
		slog.ErrorContext(ctx, "AI review scan failed", "error", err)
		return
	}

	if len(helps) == 0 {
		return
	}

	slog.DebugContext(ctx, "AI review scanning", "candidates", len(helps))

	for _, help := range helps {
		flags := w.applyRules(ctx, help)
		if len(flags) > 0 {
			slog.InfoContext(ctx, "AI flags detected",
				"help_id", help.ID,
				"flags_count", len(flags),
			)
		}
		for _, flag := range flags {
			if err := w.flagStore.Create(ctx, help.ID, flag.Type, flag.Confidence, flag.Detail); err != nil {
				slog.ErrorContext(ctx, "failed to store AI flag",
					"help_id", help.ID,
					"flag", flag.Type,
					"error", err,
				)
			}
		}
	}
}

// aiFlag represents a single AI-detected flag on a help request.
type aiFlag struct {
	Type       string
	Confidence float64
	Detail     string
}

// applyRules runs all 4 AI pre-screening rules against a help request.
// See design §3.2 for rule definitions.
func (w *AIReviewWorker) applyRules(ctx context.Context, help *model.HelpRequest) []aiFlag {
	var flags []aiFlag

	// Rule 1: Duplicate detection — nearby requests with similar description
	if f := w.ruleDuplicate(ctx, help); f != nil {
		flags = append(flags, *f)
	}

	// Rule 2: Abnormal coordinates — GPS outside reasonable bounds
	if f := w.ruleAbnormalCoords(help); f != nil {
		flags = append(flags, *f)
	}

	// Rule 3: Spam detection — excessive submissions
	if f := w.ruleSpam(ctx, help); f != nil {
		flags = append(flags, *f)
	}

	// Rule 4: Sensitive keywords — need manual verification
	if f := w.ruleSensitive(help); f != nil {
		flags = append(flags, *f)
	}

	return flags
}

// ---- Rule Implementations ----

// ruleDuplicate checks for nearby submissions with similar descriptions.
// Uses a 100m radius spatial check within a 10-minute window.
func (w *AIReviewWorker) ruleDuplicate(ctx context.Context, help *model.HelpRequest) *aiFlag {
	if w.helpRepo == nil {
		return nil // Repo not available (tests, etc.)
	}
	isDup, dupID, err := w.helpRepo.CheckDuplicate(ctx, help.DisasterID, help.OffsetLat, help.OffsetLng, "", 10*time.Minute)
	if err != nil {
		return nil
	}
	if isDup {
		return &aiFlag{
			Type:       "duplicate",
			Confidence: 0.85,
			Detail:     "nearby duplicate submission within 100m in 10min window, similar to " + dupID,
		}
	}
	return nil
}

// ruleAbnormalCoords checks for GPS coordinates outside China's approximate landmass.
// China bounds: lat 18-54, lng 73-135. Also flags (0,0) coordinates.
func (w *AIReviewWorker) ruleAbnormalCoords(help *model.HelpRequest) *aiFlag {
	lat := help.OffsetLat
	lng := help.OffsetLng

	// Zero coordinates are always suspicious
	if lat == 0 && lng == 0 {
		return &aiFlag{
			Type:       "abnormal_coords",
			Confidence: 0.95,
			Detail:     "GPS coordinates are (0.0, 0.0) — location not properly captured",
		}
	}

	// Outside China's approximate landmass bounds
	if lat < 18 || lat > 54 || lng < 73 || lng > 135 {
		return &aiFlag{
			Type:       "abnormal_coords",
			Confidence: 0.80,
			Detail:     "coordinates outside China approximate range (lat 18-54, lng 73-135)",
		}
	}

	return nil
}

// ruleSpam checks for excessive submissions in a very short time window.
func (w *AIReviewWorker) ruleSpam(ctx context.Context, help *model.HelpRequest) *aiFlag {
	if w.helpRepo == nil {
		return nil
	}
	isDup, _, err := w.helpRepo.CheckDuplicate(ctx, help.DisasterID, help.OffsetLat, help.OffsetLng, "", 1*time.Minute)
	if err != nil {
		return nil
	}
	if isDup {
		return &aiFlag{
			Type:       "spam",
			Confidence: 0.70,
			Detail:     "multiple submissions from same area within 1 minute — possible spam",
		}
	}
	return nil
}

// ruleSensitive checks the description for keywords that warrant manual review.
// Simple keyword matching for MVP; full version would use NLP/LLM.
func (w *AIReviewWorker) ruleSensitive(help *model.HelpRequest) *aiFlag {
	desc := strings.ToLower(help.Description)

	keywords := []string{
		"死亡", "尸体", "大量伤亡",
		"爆炸", "有毒", "辐射",
		"武装", "抢夺", "暴乱",
	}

	matched := make([]string, 0)
	for _, kw := range keywords {
		if strings.Contains(desc, kw) {
			matched = append(matched, kw)
		}
	}

	if len(matched) > 0 {
		return &aiFlag{
			Type:       "sensitive",
			Confidence: 0.60,
			Detail:     "description contains sensitive keywords: " + strings.Join(matched, ", "),
		}
	}

	// Check for non-Chinese content (potentially junk/spam)
	chineseCount := 0
	for _, r := range help.Description {
		if unicode.Is(unicode.Han, r) {
			chineseCount++
		}
	}
	if len([]rune(help.Description)) > 0 && float64(chineseCount)/float64(len([]rune(help.Description))) < 0.1 {
		return &aiFlag{
			Type:       "sensitive",
			Confidence: 0.30,
			Detail:     "description contains very little Chinese (possibly non-relevant content)",
		}
	}

	return nil
}

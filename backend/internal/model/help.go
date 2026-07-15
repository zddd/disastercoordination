package model

import "time"

// HelpRequest represents a help/sos request from a victim during a disaster.
// Uses dual-coordinate strategy: precise location (restricted access) and offset location (public).
type HelpRequest struct {
	ID            string    `json:"id"`
	DisasterID    string    `json:"disaster_id"`
	SubmitterID   string    `json:"submitter_id,omitempty"` // Empty for unauthenticated submissions
	Category      string    `json:"category"`               // trapped, injured, collapse, missing, water_shortage, food_shortage, transfer, custom
	Urgency       string    `json:"urgency"`                // critical, normal, mild
	Description   string    `json:"description"`
	AffectedCount int       `json:"affected_count"`

	// Dual-coordinate location strategy (see design §3.5):
	// Precise coordinates are only visible to rescue_team (accepted), commander, reviewer.
	// Offset coordinates (50-200m random offset) are publicly visible.
	PreciseLat   float64 `json:"-" db:"precise_lat"`
	PreciseLng   float64 `json:"-" db:"precise_lng"`
	OffsetLat    float64 `json:"lat" db:"offset_lat"`
	OffsetLng    float64 `json:"lng" db:"offset_lng"`
	OffsetMeters float64 `json:"-" db:"offset_meters"` // Actual offset distance applied

	// Contact info with role-based visibility (see design §3.5 matrix)
	Phone       string `json:"phone,omitempty"`
	ContactName string `json:"contact_name,omitempty"`

	// Status flow: pending_review → reviewed → in_pool → assigned → accepted → completed
	Status       string `json:"status"`
	ReviewStatus string `json:"review_status"` // pending, ai_flagged, approved, rejected, merged

	// Anti-fraud & quality
	IsIsolatedReport     bool    `json:"is_isolated_report"`     // Single report from remote area
	SubmitterCreditScore float64 `json:"submitter_credit_score"` // Copied from user.credit_score at submission

	// Archival
	IsArchived bool `json:"is_archived"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
	ReviewedAt *time.Time `json:"reviewed_at,omitempty"`
}

// HelpCategoryLabel returns a human-readable Chinese label for a help category.
func HelpCategoryLabel(category string) string {
	switch category {
	case "trapped":
		return "被困"
	case "injured":
		return "受伤"
	case "collapse":
		return "倒塌"
	case "missing":
		return "失联"
	case "water_shortage":
		return "缺水"
	case "food_shortage":
		return "缺食"
	case "transfer":
		return "需要转移"
	default:
		return "自定义"
	}
}

// UrgencyLabel returns a human-readable Chinese label for urgency level.
func UrgencyLabel(urgency string) string {
	switch urgency {
	case "critical":
		return "紧急"
	case "normal":
		return "一般"
	case "mild":
		return "轻微"
	default:
		return "未知"
	}
}

// EstimatedReviewTime returns the SLA target review time in minutes based on urgency.
// See design §3.2: critical=5min, normal=30min, mild=120min.
func EstimatedReviewTime(urgency string) int {
	switch urgency {
	case "critical":
		return 5
	case "normal":
		return 30
	case "mild":
		return 120
	default:
		return 30
	}
}

// HelpStatusResponse is the public status tracking response (no sensitive data).
type HelpStatusResponse struct {
	HelpID              string `json:"help_id"`
	Status              string `json:"status"`
	ReviewStatus        string `json:"review_status"`
	ProgressDescription string `json:"progress_description"` // Human-readable progress text
	EstimatedMinutes    int    `json:"estimated_minutes"`    // SLA estimate
}

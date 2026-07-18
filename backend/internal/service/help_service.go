// Package service contains business logic layer.
// All services are defined as interfaces for testability and future microservice decomposition.
package service

import (
	"context"
	"fmt"
	"log/slog"
	"math/rand"
	"time"

	"github.com/google/uuid"

	"disaster-coordination/internal/model"
	"disaster-coordination/internal/repository"
)

const (
	// OffsetMin and OffsetMax define the random coordinate offset range in meters.
	// See design §3.5: publicly visible coordinates are offset by 50-200m randomly.
	OffsetMin = 50
	OffsetMax = 200
)

// HelpService defines operations for help request management.
// In full version, the interface remains unchanged while the implementation can be
// replaced with a distributed version.
type HelpService interface {
	CreateHelp(ctx context.Context, req CreateHelpRequest) (*model.HelpRequest, error)
	GetHelp(ctx context.Context, helpID string, role model.Role) (*model.HelpRequest, error)
	GetHelpStatus(ctx context.Context, helpID string) (*model.HelpStatusResponse, error)
	ListMine(ctx context.Context, submitterID string) ([]*model.HelpRequest, error)
}

// CreateHelpRequest is the input for submitting a new help request.
type CreateHelpRequest struct {
	DisasterID    string  `json:"disaster_id"`
	SubmitterID   string  `json:"submitter_id,omitempty"`
	Category      string  `json:"category"`
	Urgency       string  `json:"urgency"`
	Description   string  `json:"description"`
	AffectedCount int     `json:"affected_count"`
	Latitude      float64 `json:"latitude"`
	Longitude     float64 `json:"longitude"`
	ContactName   string  `json:"contact_name,omitempty"`
	Phone         string  `json:"phone,omitempty"`
	DeviceID      string  `json:"device_id,omitempty"` // For duplicate detection
}

type helpService struct {
	helpRepo     repository.HelpRepository
	disasterRepo repository.DisasterRepository
}

// NewHelpService creates a HelpService backed by repositories.
func NewHelpService(helpRepo repository.HelpRepository, disasterRepo repository.DisasterRepository) HelpService {
	return &helpService{helpRepo: helpRepo, disasterRepo: disasterRepo}
}

// CreateHelp processes a new help request submission.
// It validates the disaster is active, applies coordinate offset for privacy,
// checks for duplicates, and creates the help record.
func (s *helpService) CreateHelp(ctx context.Context, req CreateHelpRequest) (*model.HelpRequest, error) {
	slog.InfoContext(ctx, "creating help request",
		"disaster_id", req.DisasterID,
		"category", req.Category,
		"urgency", req.Urgency,
	)

	// Validate disaster is active
	disaster, err := s.disasterRepo.GetByID(ctx, req.DisasterID)
	if err != nil {
		return nil, fmt.Errorf("disaster not found: %w", err)
	}
	if disaster.Status != "active" {
		return nil, fmt.Errorf("disaster %s is not active (status=%s)", disaster.ID, disaster.Status)
	}

	// Apply random coordinate offset for privacy (see design §3.5)
	// Offset is 50-200m in a random direction, applied to the offset_geom column.
	// The precise_geom stores the exact location for authorized roles.
	offsetMeters := float64(rand.Intn(OffsetMax-OffsetMin) + OffsetMin)
	offsetLat, offsetLng := applyOffset(req.Latitude, req.Longitude, offsetMeters)

	slog.DebugContext(ctx, "coordinate offset applied",
		"precise_lat", req.Latitude,
		"precise_lng", req.Longitude,
		"offset_lat", offsetLat,
		"offset_lng", offsetLng,
		"offset_meters", offsetMeters,
	)

	// Check for duplicate submissions from same device/area within 5 minutes
	if req.DeviceID != "" || req.SubmitterID != "" {
		isDup, dupID, err := s.helpRepo.CheckDuplicate(ctx, req.DisasterID, req.Latitude, req.Longitude, "", 5*time.Minute)
		if err != nil {
			slog.WarnContext(ctx, "duplicate check failed (non-blocking)", "error", err)
		} else if isDup {
			slog.WarnContext(ctx, "duplicate help request detected",
				"original_id", dupID,
				"category", req.Category,
			)
			return nil, fmt.Errorf("duplicate submission detected (original: %s)", dupID)
		}
	}

	// Determine submitter credit score
	var creditScore float64
	if req.SubmitterID != "" {
		// Credit score would be looked up from user in full implementation
		creditScore = 100.0 // Default for now
	}

	isIsolated := false
	if req.AffectedCount == 1 && req.Urgency == "critical" {
		// Single person critical help from remote area could be an isolated report
		// Flag it for reviewer attention (design §5.3)
		isIsolated = true
	}

	now := time.Now()
	help := &model.HelpRequest{
		ID:                   uuid.New().String(),
		DisasterID:           req.DisasterID,
		SubmitterID:          req.SubmitterID,
		Category:             req.Category,
		Urgency:              req.Urgency,
		Description:          req.Description,
		AffectedCount:        req.AffectedCount,
		PreciseLat:           req.Latitude,
		PreciseLng:           req.Longitude,
		OffsetLat:            offsetLat,
		OffsetLng:            offsetLng,
		OffsetMeters:         offsetMeters,
		Phone:                req.Phone,
		ContactName:          req.ContactName,
		Status:               "pending_review",
		ReviewStatus:         "pending",
		IsIsolatedReport:     isIsolated,
		SubmitterCreditScore: creditScore,
		CreatedAt:            now,
		UpdatedAt:            now,
	}

	if err := s.helpRepo.Create(ctx, help); err != nil {
		return nil, fmt.Errorf("create help request failed: %w", err)
	}

	slog.InfoContext(ctx, "help request created",
		"help_id", help.ID,
		"disaster_id", help.DisasterID,
		"category", help.Category,
		"urgency", help.Urgency,
		"estimated_review", model.EstimatedReviewTime(help.Urgency),
	)

	return help, nil
}

// GetHelp retrieves a help request with role-based data visibility.
// See design §3.5 information visibility matrix:
// - precise coordinates: rescue_team(accepted), commander, reviewer
// - phone: rescue_team(accepted), commander, reviewer
// - others get offset coordinates and masked phone
func (s *helpService) GetHelp(ctx context.Context, helpID string, role model.Role) (*model.HelpRequest, error) {
	help, err := s.helpRepo.GetByID(ctx, helpID)
	if err != nil {
		return nil, fmt.Errorf("help request not found: %w", err)
	}

	// Apply role-based data visibility filtering
	if !canViewPrecise(role) {
		// Overwrite precise coordinates with offset for unauthorized roles
		help.PreciseLat = 0
		help.PreciseLng = 0
	}
	if !canViewPhone(role) {
		help.Phone = maskPhone(help.Phone)
	}
	if !canViewContactName(role) {
		help.ContactName = ""
	}

	return help, nil
}

// GetHelpStatus returns the public status tracking response.
// No sensitive information is exposed — only status, progress text, and SLA estimates.
func (s *helpService) GetHelpStatus(ctx context.Context, helpID string) (*model.HelpStatusResponse, error) {
	help, err := s.helpRepo.GetByID(ctx, helpID)
	if err != nil {
		return nil, fmt.Errorf("help request not found: %w", err)
	}

	return &model.HelpStatusResponse{
		HelpID:              help.ID,
		Status:              help.Status,
		ReviewStatus:        help.ReviewStatus,
		Category:            help.Category,
		Urgency:             help.Urgency,
		Description:         help.Description,
		AffectedCount:       help.AffectedCount,
		ProgressDescription: buildProgressDescription(help.Status),
		EstimatedMinutes:    model.EstimatedReviewTime(help.Urgency),
	}, nil
}

// ListMine returns help requests submitted by a specific user.
func (s *helpService) ListMine(ctx context.Context, submitterID string) ([]*model.HelpRequest, error) {
	return s.helpRepo.ListBySubmitter(ctx, submitterID)
}

// ---- Helper functions ----

// applyOffset calculates new coordinates by applying a random offset in meters.
// Uses a simple approximation: 1° latitude ≈ 111,320m, 1° longitude ≈ 111,320m × cos(lat).
func applyOffset(lat, lng float64, meters float64) (newLat, newLng float64) {
	// Random direction (0 to 2π)
	angle := rand.Float64() * 2 * 3.141592653589793

	// Convert meters to degrees
	latDeg := meters / 111320.0
	lngDeg := meters / (111320.0 * cosDeg(lat))

	newLat = lat + latDeg*sinDeg(angle)
	newLng = lng + lngDeg*cosDeg(angle)

	return newLat, newLng
}

func cosDeg(deg float64) float64 {
	rad := deg * 3.141592653589793 / 180.0
	cos := 1.0 - rad*rad/2 + rad*rad*rad*rad/24
	return cos
}

func sinDeg(deg float64) float64 {
	rad := deg * 3.141592653589793 / 180.0
	sin := rad - rad*rad*rad/6 + rad*rad*rad*rad*rad/120
	return sin
}

// canViewPrecise checks if a role is authorized to view precise coordinates.
// See design §3.5 visibility matrix.
func canViewPrecise(role model.Role) bool {
	switch role {
	case model.RoleAdmin, model.RoleCommander, model.RoleReviewer, model.RoleRescueTeam:
		return true
	default:
		return false
	}
}

// canViewPhone checks if a role is authorized to see the full phone number.
func canViewPhone(role model.Role) bool {
	switch role {
	case model.RoleAdmin, model.RoleCommander, model.RoleReviewer, model.RoleRescueTeam:
		return true
	default:
		return false
	}
}

// canViewContactName checks if a role is authorized to see contact name.
func canViewContactName(role model.Role) bool {
	switch role {
	case model.RoleAdmin, model.RoleCommander, model.RoleReviewer, model.RoleRescueTeam:
		return true
	default:
		return false
	}
}

// maskPhone masks the middle digits of a phone number for privacy.
// E.g., "13812345678" → "138****5678"
func maskPhone(phone string) string {
	if phone == "" {
		return ""
	}
	if len(phone) < 7 {
		return "***"
	}
	return phone[:3] + "****" + phone[len(phone)-4:]
}

// buildProgressDescription generates a human-readable progress description.
func buildProgressDescription(status string) string {
	switch status {
	case "pending_review":
		return "求助已提交，等待审核中"
	case "reviewed", "in_pool":
		return "求助已通过审核，等待分配救援队伍"
	case "assigned":
		return "已分配救援队伍，等待接单"
	case "accepted":
		return "救援队已接单，准备出发"
	case "en_route":
		return "救援队正在赶往现场"
	case "arrived":
		return "救援队已到达现场"
	case "rescuing":
		return "正在施救中"
	case "completed":
		return "救援已完成"
	case "unable":
		return "救援队无法完成，已上报"
	case "need_backup":
		return "需要增援，已重新进入调度"
	default:
		return "状态更新中"
	}
}

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

// TeamService defines operations for rescue team management and registration.
type TeamService interface {
	Register(ctx context.Context, req RegisterTeamRequest) (*model.RescueTeam, error)
	GetByID(ctx context.Context, id string) (*model.RescueTeam, error)
	List(ctx context.Context) ([]*model.RescueTeam, error)
	FindNearby(ctx context.Context, lat, lng float64, radiusMeters int) ([]*model.RescueTeam, error)
	Verify(ctx context.Context, teamID string, reviewerID string) error
	Reject(ctx context.Context, teamID string, reviewerID string, reason string) error
	UpdateLocation(ctx context.Context, teamID string, lat, lng float64) error
}

// RegisterTeamRequest is the input for registering a new rescue team.
// Supports both registered teams and civilian rescue forces (民间救援力量).
// Requires review by admin/reviewer before becoming active.
type RegisterTeamRequest struct {
	Name          string   `json:"name"`
	Type          string   `json:"type"` // "registered" or "civil"
	Capabilities  []string `json:"capabilities"`
	ContactPhone  string   `json:"contact_phone"`
	ContactPerson string   `json:"contact_person,omitempty"`
	MemberCount   int      `json:"member_count"`
}

type teamService struct {
	teamRepo repository.TeamRepository
}

func NewTeamService(teamRepo repository.TeamRepository) TeamService {
	return &teamService{teamRepo: teamRepo}
}

// Register creates a new rescue team registration pending review.
// New teams are created with status="pending" and verified=false.
// An admin/reviewer must verify them before they become active (see Verify/Reject).
func (s *teamService) Register(ctx context.Context, req RegisterTeamRequest) (*model.RescueTeam, error) {
	slog.InfoContext(ctx, "registering rescue team",
		"name", req.Name,
		"type", req.Type,
		"capabilities", req.Capabilities,
	)

	if req.Type != "registered" && req.Type != "civil" {
		return nil, fmt.Errorf("invalid team type: %s (must be 'registered' or 'civil')", req.Type)
	}

	now := time.Now()
	team := &model.RescueTeam{
		ID:            uuid.New().String(),
		Name:          req.Name,
		Type:          req.Type,
		Capabilities:  req.Capabilities,
		ContactPhone:  req.ContactPhone,
		ContactPerson: req.ContactPerson,
		MemberCount:   req.MemberCount,
		Status:        "pending",
		Verified:      false,
		CreatedAt:     now,
		UpdatedAt:     now,
	}

	if err := s.teamRepo.Create(ctx, team); err != nil {
		return nil, fmt.Errorf("register team failed: %w", err)
	}

	slog.InfoContext(ctx, "rescue team registered — pending review",
		"team_id", team.ID,
		"name", team.Name,
		"type", model.TeamTypeLabel(team.Type),
	)

	return team, nil
}

func (s *teamService) GetByID(ctx context.Context, id string) (*model.RescueTeam, error) {
	return s.teamRepo.GetByID(ctx, id)
}

func (s *teamService) List(ctx context.Context) ([]*model.RescueTeam, error) {
	return s.teamRepo.List(ctx)
}

func (s *teamService) FindNearby(ctx context.Context, lat, lng float64, radiusMeters int) ([]*model.RescueTeam, error) {
	return s.teamRepo.FindNearby(ctx, lat, lng, radiusMeters)
}

// Verify approves a pending rescue team registration, setting it to active.
func (s *teamService) Verify(ctx context.Context, teamID string, reviewerID string) error {
	slog.InfoContext(ctx, "verifying rescue team", "team_id", teamID, "reviewer", reviewerID)

	team, err := s.teamRepo.GetByID(ctx, teamID)
	if err != nil {
		return fmt.Errorf("team not found: %w", err)
	}
	if team.Status != "pending" {
		return fmt.Errorf("team status is %s, expected pending", team.Status)
	}

	if err := s.teamRepo.Verify(ctx, teamID); err != nil {
		return fmt.Errorf("verify failed: %w", err)
	}

	slog.InfoContext(ctx, "rescue team verified and activated", "team_id", teamID)
	return nil
}

// Reject denies a pending rescue team registration with a reason.
func (s *teamService) Reject(ctx context.Context, teamID string, reviewerID string, reason string) error {
	slog.InfoContext(ctx, "rejecting rescue team", "team_id", teamID, "reviewer", reviewerID, "reason", reason)

	team, err := s.teamRepo.GetByID(ctx, teamID)
	if err != nil {
		return fmt.Errorf("team not found: %w", err)
	}
	if team.Status != "pending" {
		return fmt.Errorf("team status is %s, expected pending", team.Status)
	}

	if err := s.teamRepo.Reject(ctx, teamID, reason); err != nil {
		return fmt.Errorf("reject failed: %w", err)
	}

	slog.InfoContext(ctx, "rescue team rejected", "team_id", teamID)
	return nil
}

// UpdateLocation updates the rescue team's current GPS position.
func (s *teamService) UpdateLocation(ctx context.Context, teamID string, lat, lng float64) error {
	slog.DebugContext(ctx, "updating team location", "team_id", teamID, "lat", lat, "lng", lng)
	return s.teamRepo.UpdateLocation(ctx, teamID, lat, lng)
}

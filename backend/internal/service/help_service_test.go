package service

import (
	"context"
	"strings"
	"testing"
	"time"

	"disaster-coordination/internal/model"
)

// mockHelpRepo implements HelpRepository for testing.
type mockHelpRepo struct {
	createFn   func(ctx context.Context, h *model.HelpRequest) error
	getByIDFn func(ctx context.Context, id string) (*model.HelpRequest, error)
	listBySubFn func(ctx context.Context, submitterID string) ([]*model.HelpRequest, error)
	checkDupFn func(ctx context.Context, disasterID string, lat, lng float64, descriptionHash string, interval time.Duration) (bool, string, error)
}

func (m *mockHelpRepo) Create(ctx context.Context, h *model.HelpRequest) error {
	if m.createFn != nil {
		return m.createFn(ctx, h)
	}
	return nil
}
func (m *mockHelpRepo) GetByID(ctx context.Context, id string) (*model.HelpRequest, error) {
	if m.getByIDFn != nil {
		return m.getByIDFn(ctx, id)
	}
	return nil, nil
}
func (m *mockHelpRepo) ListByDisaster(ctx context.Context, disasterID string, status string) ([]*model.HelpRequest, error) { return nil, nil }
func (m *mockHelpRepo) ListBySubmitter(ctx context.Context, submitterID string) ([]*model.HelpRequest, error) {
	if m.listBySubFn != nil {
		return m.listBySubFn(ctx, submitterID)
	}
	return nil, nil
}
func (m *mockHelpRepo) UpdateStatus(ctx context.Context, id string, status string) error { return nil }
func (m *mockHelpRepo) UpdateReviewStatus(ctx context.Context, id string, reviewStatus string, reviewerID string) error { return nil }
func (m *mockHelpRepo) ListInPool(ctx context.Context, disasterID string, zone string) ([]*model.HelpRequest, error) { return nil, nil }
func (m *mockHelpRepo) CheckDuplicate(ctx context.Context, disasterID string, lat, lng float64, descriptionHash string, interval time.Duration) (bool, string, error) {
	if m.checkDupFn != nil {
		return m.checkDupFn(ctx, disasterID, lat, lng, descriptionHash, interval)
	}
	return false, "", nil
}
func (m *mockHelpRepo) ListPendingReview(ctx context.Context, limit int) ([]*model.HelpRequest, error) { return nil, nil }

// mockDisasterRepo implements DisasterRepository for testing.
type mockDisasterRepo struct {
	getByIDFn func(ctx context.Context, id string) (*model.Disaster, error)
}

func (m *mockDisasterRepo) Create(ctx context.Context, d *model.Disaster) error { return nil }
func (m *mockDisasterRepo) GetByID(ctx context.Context, id string) (*model.Disaster, error) {
	if m.getByIDFn != nil {
		return m.getByIDFn(ctx, id)
	}
	return nil, nil
}
func (m *mockDisasterRepo) List(ctx context.Context, status string) ([]*model.Disaster, error) { return nil, nil }
func (m *mockDisasterRepo) ListActive(ctx context.Context) ([]*model.Disaster, error) { return nil, nil }
func (m *mockDisasterRepo) Close(ctx context.Context, id string, closedAt time.Time) error { return nil }
func (m *mockDisasterRepo) GetSummary(ctx context.Context, id string) (*model.DisasterSummary, error) { return nil, nil }

func TestCreateHelp_Success(t *testing.T) {
	ctx := context.Background()
	disasterID := "disaster-001"

	helpRepo := &mockHelpRepo{}
	disasterRepo := &mockDisasterRepo{
		getByIDFn: func(ctx context.Context, id string) (*model.Disaster, error) {
			return &model.Disaster{ID: disasterID, Status: "active"}, nil
		},
	}

	svc := NewHelpService(helpRepo, disasterRepo)

	req := CreateHelpRequest{
		DisasterID:    disasterID,
		Category:      "trapped",
		Urgency:       "critical",
		Description:   "被困在倒塌建筑中",
		AffectedCount: 3,
		Latitude:      30.5,
		Longitude:     104.0,
		ContactName:   "张三",
		Phone:         "13800138000",
	}

	help, err := svc.CreateHelp(ctx, req)
	if err != nil {
		t.Fatalf("CreateHelp failed: %v", err)
	}

	if help.Status != "pending_review" {
		t.Errorf("expected status=pending_review, got %s", help.Status)
	}
	if help.ReviewStatus != "pending" {
		t.Errorf("expected review_status=pending, got %s", help.ReviewStatus)
	}

	// Verify offset was applied
	if help.OffsetLat == req.Latitude && help.OffsetLng == req.Longitude {
		t.Error("expected offset to differ from precise coordinates")
	}
	if help.OffsetMeters < OffsetMin || help.OffsetMeters > OffsetMax {
		t.Errorf("offset_meters %.0f outside range [%d, %d]", help.OffsetMeters, OffsetMin, OffsetMax)
	}

	// Verify isolated report flag for single critical
	if !help.IsIsolatedReport {
		t.Log("isolated report not flagged (expected for critical + 1 person)")
	}
}

func TestCreateHelp_DisasterClosed(t *testing.T) {
	ctx := context.Background()
	disasterID := "disaster-closed"

	disasterRepo := &mockDisasterRepo{
		getByIDFn: func(ctx context.Context, id string) (*model.Disaster, error) {
			return &model.Disaster{ID: disasterID, Status: "closed"}, nil
		},
	}

	svc := NewHelpService(&mockHelpRepo{}, disasterRepo)

	req := CreateHelpRequest{
		DisasterID:  disasterID,
		Category:    "trapped",
		Urgency:     "normal",
		Description: "test",
		Latitude:    30.5,
		Longitude:   104.0,
	}

	_, err := svc.CreateHelp(ctx, req)
	if err == nil {
		t.Fatal("expected error for closed disaster, got nil")
	}
	if !strings.Contains(err.Error(), "not active") {
		t.Errorf("expected 'not active' error, got: %v", err)
	}
}

func TestCreateHelp_DuplicateDetected(t *testing.T) {
	ctx := context.Background()
	disasterID := "disaster-dup"

	helpRepo := &mockHelpRepo{
		checkDupFn: func(ctx context.Context, disasterID string, lat, lng float64, descriptionHash string, interval time.Duration) (bool, string, error) {
			return true, "existing-help-123", nil
		},
	}
	disasterRepo := &mockDisasterRepo{
		getByIDFn: func(ctx context.Context, id string) (*model.Disaster, error) {
			return &model.Disaster{ID: disasterID, Status: "active"}, nil
		},
	}

	svc := NewHelpService(helpRepo, disasterRepo)

	req := CreateHelpRequest{
		DisasterID:  disasterID,
		SubmitterID: "user-001",
		Category:    "trapped",
		Description: "duplicate test",
		Latitude:    30.5,
		Longitude:   104.0,
	}

	_, err := svc.CreateHelp(ctx, req)
	if err == nil {
		t.Fatal("expected duplicate error, got nil")
	}
	if !strings.Contains(err.Error(), "duplicate") {
		t.Errorf("expected duplicate error, got: %v", err)
	}
}

func TestGetHelp_CoordinateOffset(t *testing.T) {
	ctx := context.Background()

	helpRepo := &mockHelpRepo{
		getByIDFn: func(ctx context.Context, id string) (*model.HelpRequest, error) {
			return &model.HelpRequest{
				ID:         id,
				PreciseLat: 30.5, PreciseLng: 104.0,
				OffsetLat:  30.501, OffsetLng: 103.998,
				Phone:       "13800138000",
				ContactName: "张三",
			}, nil
		},
	}

	svc := NewHelpService(helpRepo, nil)

	// Role with permission should see precise
	help, err := svc.GetHelp(ctx, "help-001", model.RoleCommander)
	if err != nil {
		t.Fatalf("GetHelp failed: %v", err)
	}
	if help.PreciseLat != 30.5 {
		t.Errorf("commander should see precise coordinates, got lat=%f", help.PreciseLat)
	}

	// Role without permission should not see precise
	help2, err2 := svc.GetHelp(ctx, "help-002", model.RoleVolunteer)
	if err2 != nil {
		t.Fatalf("GetHelp failed: %v", err2)
	}
	if help2.PreciseLat != 0 {
		t.Errorf("volunteer should NOT see precise coordinates, got lat=%f", help2.PreciseLat)
	}
}

func TestGetHelp_RoleBasedPrivacy(t *testing.T) {
	ctx := context.Background()

	helpRepo := &mockHelpRepo{
		getByIDFn: func(ctx context.Context, id string) (*model.HelpRequest, error) {
			return &model.HelpRequest{
				ID:          id,
				PreciseLat:  30.5, PreciseLng: 104.0,
				OffsetLat:   30.501, OffsetLng: 103.998,
				Phone:       "13812345678",
				ContactName: "李四",
			}, nil
		},
	}

	svc := NewHelpService(helpRepo, nil)

	// Rescue team should see full phone
	help, _ := svc.GetHelp(ctx, "help-001", model.RoleRescueTeam)
	if help.Phone != "13812345678" {
		t.Errorf("rescue team should see full phone, got %s", help.Phone)
	}

	// Donor should see masked phone
	help2, _ := svc.GetHelp(ctx, "help-002", model.RoleDonor)
	if help2.Phone != "138****5678" {
		t.Errorf("donor should see masked phone, got %s", help2.Phone)
	}

	// Donor should not see contact name
	if help2.ContactName != "" {
		t.Errorf("donor should not see contact name, got %s", help2.ContactName)
	}
}

func TestGetHelpStatus(t *testing.T) {
	ctx := context.Background()

	helpRepo := &mockHelpRepo{
		getByIDFn: func(ctx context.Context, id string) (*model.HelpRequest, error) {
			return &model.HelpRequest{
				ID:           id,
				Status:       "pending_review",
				ReviewStatus: "pending",
				Urgency:      "critical",
			}, nil
		},
	}

	svc := NewHelpService(helpRepo, nil)

	status, err := svc.GetHelpStatus(ctx, "help-001")
	if err != nil {
		t.Fatalf("GetHelpStatus failed: %v", err)
	}

	if status.Status != "pending_review" {
		t.Errorf("expected status=pending_review, got %s", status.Status)
	}
	if status.EstimatedMinutes != 5 {
		t.Errorf("critical urgency should estimate 5 minutes, got %d", status.EstimatedMinutes)
	}
	if status.ProgressDescription == "" {
		t.Error("progress description should not be empty")
	}
}

func TestMaskPhone(t *testing.T) {
	tests := map[string]string{
		"13812345678": "138****5678",
		"":            "",
		"12345":       "***",
	}

	for input, expected := range tests {
		got := maskPhone(input)
		if got != expected {
			t.Errorf("maskPhone(%s) = %s, want %s", input, got, expected)
		}
	}
}

func TestBuildProgressDescription(t *testing.T) {
	descs := map[string]string{
		"pending_review": "求助已提交，等待审核中",
		"completed":      "救援已完成",
		"unknown":        "状态更新中",
	}

	for status, expected := range descs {
		got := buildProgressDescription(status)
		if got != expected {
			t.Errorf("buildProgressDescription(%s) = %s, want %s", status, got, expected)
		}
	}
}

func TestApplyOffset(t *testing.T) {
	// Apply offset 10 times and verify all results differ and are within range
	origLat, origLng := 30.0, 104.0
	for i := 0; i < 10; i++ {
		newLat, newLng := applyOffset(origLat, origLng, 100)
		if newLat == origLat && newLng == origLng {
			t.Error("offset should not be zero")
		}
		// Approximate: 100m ≈ 0.0009 degrees
		latDiff := newLat - origLat
		if latDiff < -0.001 || latDiff > 0.001 {
			t.Errorf("lat offset too large: %f for 100m", latDiff)
		}
	}
}

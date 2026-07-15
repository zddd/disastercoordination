package service

import (
	"context"
	"testing"

	"disaster-coordination/internal/model"
)

func TestDisasterService_Create(t *testing.T) {
	disasterRepo := &mockDisasterRepo{}
	taskRepo := &mockTaskRepo{}

	svc := NewDisasterService(disasterRepo, taskRepo)
	ctx := context.Background()

	req := CreateDisasterRequest{
		Name:        "测试地震",
		Type:        model.DisasterEarthquake,
		Level:       "red",
		Description: "6.8级地震测试",
		CreatedBy:   "user-001",
	}

	d, err := svc.Create(ctx, req)
	if err != nil {
		t.Fatalf("Create failed: %v", err)
	}
	if d.Name != req.Name {
		t.Errorf("expected name=%s, got %s", req.Name, d.Name)
	}
	if d.Status != "active" {
		t.Errorf("expected status=active, got %s", d.Status)
	}
}

func TestDisasterService_Close_AlreadyClosed(t *testing.T) {
	disasterRepo := &mockDisasterRepo{
		getByIDFn: func(ctx context.Context, id string) (*model.Disaster, error) {
			return &model.Disaster{ID: id, Status: "closed"}, nil
		},
	}
	taskRepo := &mockTaskRepo{}

	svc := NewDisasterService(disasterRepo, taskRepo)
	ctx := context.Background()

	_, err := svc.Close(ctx, "disaster-001", "admin-001")
	if err == nil {
		t.Fatal("expected error for already closed disaster")
	}
}

func TestReviewService_Approve(t *testing.T) {
	helpRepo := &mockHelpRepo{
		getByIDFn: func(ctx context.Context, id string) (*model.HelpRequest, error) {
			return &model.HelpRequest{ID: id, ReviewStatus: "pending", Status: "pending_review"}, nil
		},
	}
	userRepo := &mockUserRepo{}

	svc := NewReviewService(helpRepo, userRepo)
	ctx := context.Background()

	err := svc.Approve(ctx, "help-001", "reviewer-001")
	if err != nil {
		t.Fatalf("Approve failed: %v", err)
	}
}

func TestReviewService_Approve_AlreadyReviewed(t *testing.T) {
	helpRepo := &mockHelpRepo{
		getByIDFn: func(ctx context.Context, id string) (*model.HelpRequest, error) {
			return &model.HelpRequest{ID: id, ReviewStatus: "approved"}, nil
		},
	}
	userRepo := &mockUserRepo{}

	svc := NewReviewService(helpRepo, userRepo)
	ctx := context.Background()

	err := svc.Approve(ctx, "help-001", "reviewer-001")
	if err == nil {
		t.Fatal("expected error for already approved help")
	}
}

func TestReviewService_Reject(t *testing.T) {
	helpRepo := &mockHelpRepo{
		getByIDFn: func(ctx context.Context, id string) (*model.HelpRequest, error) {
			return &model.HelpRequest{ID: id, SubmitterID: "user-001", ReviewStatus: "pending", Status: "pending_review"}, nil
		},
	}
	userRepo := &mockUserRepo{}

	svc := NewReviewService(helpRepo, userRepo)
	ctx := context.Background()

	err := svc.Reject(ctx, "help-001", "reviewer-001", "虚假求助")
	if err != nil {
		t.Fatalf("Reject failed: %v", err)
	}
}

func TestReviewService_Merge(t *testing.T) {
	helpRepo := &mockHelpRepo{
		getByIDFn: func(ctx context.Context, id string) (*model.HelpRequest, error) {
			return &model.HelpRequest{ID: id}, nil
		},
	}
	userRepo := &mockUserRepo{}

	svc := NewReviewService(helpRepo, userRepo)
	ctx := context.Background()

	err := svc.Merge(ctx, "help-primary", []string{"help-dup-1", "help-dup-2"}, "reviewer-001")
	if err != nil {
		t.Fatalf("Merge failed: %v", err)
	}
}

func TestTruncateString(t *testing.T) {
	tests := []struct {
		input  string
		maxLen int
		want   string
	}{
		{"short", 100, "short"},
		{"a very long description that exceeds the limit", 10, "a very lon..."},
		{"", 10, ""},
	}

	for _, tt := range tests {
		got := truncateString(tt.input, tt.maxLen)
		if got != tt.want {
			t.Errorf("truncateString(%s, %d) = %s, want %s", tt.input, tt.maxLen, got, tt.want)
		}
	}
}

// mockTaskRepo implements repository.TaskRepository for testing.
type mockTaskRepo struct {
	listByDisasterFn func(ctx context.Context, id string) ([]*model.RescueTask, error)
}

func (m *mockTaskRepo) Create(ctx context.Context, t *model.RescueTask) error { return nil }
func (m *mockTaskRepo) GetByID(ctx context.Context, id string) (*model.RescueTask, error) { return nil, nil }
func (m *mockTaskRepo) ListByTeam(ctx context.Context, teamID string, status string) ([]*model.RescueTask, error) { return nil, nil }
func (m *mockTaskRepo) ListByDisaster(ctx context.Context, id string) ([]*model.RescueTask, error) {
	if m.listByDisasterFn != nil {
		return m.listByDisasterFn(ctx, id)
	}
	return nil, nil
}
func (m *mockTaskRepo) UpdateStatus(ctx context.Context, id string, status string, operatorID string, notes string) error { return nil }
func (m *mockTaskRepo) AppendStatusHistory(ctx context.Context, id string, entry model.StatusHistoryEntry) error { return nil }
func (m *mockTaskRepo) Reject(ctx context.Context, id string, reason string, operatorID string) error { return nil }

// mockUserRepo implements repository.UserRepository for testing.
type mockUserRepo struct{}

func (m *mockUserRepo) Create(ctx context.Context, u *model.User) error { return nil }
func (m *mockUserRepo) GetByID(ctx context.Context, id string) (*model.User, error) { return nil, nil }
func (m *mockUserRepo) GetByUsername(ctx context.Context, username string) (*model.User, error) { return nil, nil }
func (m *mockUserRepo) UpdateCreditScore(ctx context.Context, id string, delta float64) error { return nil }

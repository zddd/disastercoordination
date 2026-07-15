package service

import (
	"context"
	"testing"

	"disaster-coordination/internal/model"
)

func TestDispatchService_Assign(t *testing.T) {
	helpRepo := &mockHelpRepo{
		getByIDFn: func(ctx context.Context, id string) (*model.HelpRequest, error) {
			return &model.HelpRequest{
				ID:         id,
				DisasterID: "disaster-001",
				Status:     "in_pool",
				OffsetLat:  30.5,
				OffsetLng:  104.0,
			}, nil
		},
	}
	teamRepo := &mockTeamRepo{
		getByIDFn: func(ctx context.Context, id string) (*model.RescueTeam, error) {
			return &model.RescueTeam{ID: id, Name: "蓝天救援队", Status: "active"}, nil
		},
	}
	taskRepo := &mockTaskRepo{}

	svc := NewDispatchService(helpRepo, taskRepo, teamRepo)
	ctx := context.Background()

	task, err := svc.Assign(ctx, "help-001", "team-001", "commander-001")
	if err != nil {
		t.Fatalf("Assign failed: %v", err)
	}
	if task.Status != model.TaskStatusAssigned {
		t.Errorf("expected status=assigned, got %s", task.Status)
	}
	if task.TeamID != "team-001" {
		t.Errorf("expected team_id=team-001, got %s", task.TeamID)
	}
}

func TestDispatchService_Assign_NotInPool(t *testing.T) {
	helpRepo := &mockHelpRepo{
		getByIDFn: func(ctx context.Context, id string) (*model.HelpRequest, error) {
			return &model.HelpRequest{ID: id, Status: "pending_review"}, nil
		},
	}
	teamRepo := &mockTeamRepo{}
	taskRepo := &mockTaskRepo{}

	svc := NewDispatchService(helpRepo, taskRepo, teamRepo)
	ctx := context.Background()

	_, err := svc.Assign(ctx, "help-001", "team-001", "commander-001")
	if err == nil {
		t.Fatal("expected error for help not in pool")
	}
}

func TestDispatchService_SuggestTeams_MVP_ReturnsNil(t *testing.T) {
	svc := NewDispatchService(nil, nil, nil)
	ctx := context.Background()

	teams, err := svc.SuggestTeams(ctx, "help-001")
	if err != nil {
		t.Errorf("unexpected error: %v", err)
	}
	if teams != nil {
		t.Errorf("MVP should return nil suggestions, got %v", teams)
	}
}

func TestTaskService_UpdateStatus_ValidTransition(t *testing.T) {
	taskRepo := &mockTaskRepo{
		getByIDFn: func(ctx context.Context, id string) (*model.RescueTask, error) {
			return &model.RescueTask{
				ID:     id,
				Status: model.TaskStatusAssigned,
				HelpRequestID: "help-001",
			}, nil
		},
	}
	helpRepo := &mockHelpRepo{}

	svc := NewTaskService(taskRepo, helpRepo)
	ctx := context.Background()

	task, err := svc.UpdateStatus(ctx, "task-001", model.TaskStatusAccepted, "team-001", "")
	if err != nil {
		t.Fatalf("UpdateStatus failed: %v", err)
	}
	if task == nil {
		t.Fatal("expected non-nil task")
	}
}

func TestTaskService_UpdateStatus_InvalidTransition(t *testing.T) {
	taskRepo := &mockTaskRepo{
		getByIDFn: func(ctx context.Context, id string) (*model.RescueTask, error) {
			return &model.RescueTask{ID: id, Status: model.TaskStatusCompleted}, nil
		},
	}
	helpRepo := &mockHelpRepo{}

	svc := NewTaskService(taskRepo, helpRepo)
	ctx := context.Background()

	_, err := svc.UpdateStatus(ctx, "task-001", model.TaskStatusAccepted, "team-001", "")
	if err == nil {
		t.Fatal("expected error for invalid transition")
	}
}

func TestTaskService_Reject(t *testing.T) {
	taskRepo := &mockTaskRepo{
		getByIDFn: func(ctx context.Context, id string) (*model.RescueTask, error) {
			return &model.RescueTask{
				ID:            id,
				TeamID:        "team-001",
				HelpRequestID: "help-001",
				Status:        model.TaskStatusAssigned,
			}, nil
		},
	}
	helpRepo := &mockHelpRepo{}

	svc := NewTaskService(taskRepo, helpRepo)
	ctx := context.Background()

	err := svc.Reject(ctx, "task-001", "team-001", "队伍人员不足")
	if err != nil {
		t.Fatalf("Reject failed: %v", err)
	}
}

func TestTaskService_Reject_WrongTeam(t *testing.T) {
	taskRepo := &mockTaskRepo{
		getByIDFn: func(ctx context.Context, id string) (*model.RescueTask, error) {
			return &model.RescueTask{ID: id, TeamID: "team-002", Status: model.TaskStatusAssigned}, nil
		},
	}
	helpRepo := &mockHelpRepo{}

	svc := NewTaskService(taskRepo, helpRepo)
	ctx := context.Background()

	err := svc.Reject(ctx, "task-001", "team-001", "wrong team")
	if err == nil {
		t.Fatal("expected error for wrong team")
	}
}

// mockTeamRepo implements repository.TeamRepository for testing.
type mockTeamRepo struct {
	getByIDFn  func(ctx context.Context, id string) (*model.RescueTeam, error)
	findNearbyFn func(ctx context.Context, lat, lng float64, radiusMeters int) ([]*model.RescueTeam, error)
}

func (m *mockTeamRepo) Create(ctx context.Context, t *model.RescueTeam) error { return nil }
func (m *mockTeamRepo) GetByID(ctx context.Context, id string) (*model.RescueTeam, error) {
	if m.getByIDFn != nil {
		return m.getByIDFn(ctx, id)
	}
	return nil, nil
}
func (m *mockTeamRepo) List(ctx context.Context) ([]*model.RescueTeam, error) { return nil, nil }
func (m *mockTeamRepo) FindNearby(ctx context.Context, lat, lng float64, radiusMeters int) ([]*model.RescueTeam, error) {
	if m.findNearbyFn != nil {
		return m.findNearbyFn(ctx, lat, lng, radiusMeters)
	}
	return nil, nil
}
func (m *mockTeamRepo) UpdateStatus(ctx context.Context, id string, status string) error { return nil }
func (m *mockTeamRepo) Verify(ctx context.Context, id string) error { return nil }
func (m *mockTeamRepo) Reject(ctx context.Context, id string, reason string) error { return nil }
func (m *mockTeamRepo) UpdateLocation(ctx context.Context, id string, lat, lng float64) error { return nil }

package service

import (
	"context"
	"testing"

	"golang.org/x/crypto/bcrypt"

	"disaster-coordination/internal/model"
)

func TestTeamService_Register(t *testing.T) {
	teamRepo := &mockTeamRepo{}
	svc := NewTeamService(teamRepo)
	ctx := context.Background()

	req := RegisterTeamRequest{
		Name:         "蓝天救援队",
		Type:         "registered",
		Capabilities: []string{"water", "mountain"},
		ContactPhone: "13800138000",
		ContactPerson: "张队长",
		MemberCount:  30,
	}

	team, err := svc.Register(ctx, req)
	if err != nil {
		t.Fatalf("Register failed: %v", err)
	}
	if team.Status != "pending" {
		t.Errorf("expected pending, got %s", team.Status)
	}
	if team.Verified {
		t.Error("new team should not be verified")
	}
}

func TestTeamService_Register_InvalidType(t *testing.T) {
	teamRepo := &mockTeamRepo{}
	svc := NewTeamService(teamRepo)
	ctx := context.Background()

	req := RegisterTeamRequest{
		Name:         "test",
		Type:         "invalid_type",
		ContactPhone: "123",
	}

	_, err := svc.Register(ctx, req)
	if err == nil {
		t.Fatal("expected error for invalid type")
	}
}

func TestTeamService_Verify(t *testing.T) {
	teamRepo := &mockTeamRepo{
		getByIDFn: func(ctx context.Context, id string) (*model.RescueTeam, error) {
			return &model.RescueTeam{ID: id, Status: "pending"}, nil
		},
	}
	svc := NewTeamService(teamRepo)
	ctx := context.Background()

	err := svc.Verify(ctx, "team-001", "reviewer-001")
	if err != nil {
		t.Fatalf("Verify failed: %v", err)
	}
}

func TestAuthService_Register(t *testing.T) {
	userRepo := &mockUserRepo{}
	svc := NewAuthService(userRepo, "test-secret")
	ctx := context.Background()

	req := RegisterRequest{
		Username: "testuser",
		Password: "password123",
		Role:     "victim",
	}

	user, err := svc.Register(ctx, req)
	if err != nil {
		t.Fatalf("Register failed: %v", err)
	}
	if user.Username != "testuser" {
		t.Errorf("expected testuser, got %s", user.Username)
	}
	if user.Role != model.RoleVictim {
		t.Errorf("expected victim role, got %s", user.Role)
	}
	// Password should be hashed (not stored in plaintext)
	if user.PasswordHash == "password123" {
		t.Error("password should be hashed, not plaintext")
	}
}

func TestAuthService_Register_InvalidRole(t *testing.T) {
	userRepo := &mockUserRepo{}
	svc := NewAuthService(userRepo, "test-secret")
	ctx := context.Background()

	req := RegisterRequest{
		Username: "testuser",
		Password: "password123",
		Role:     "god_mode",
	}

	_, err := svc.Register(ctx, req)
	if err == nil {
		t.Fatal("expected error for invalid role")
	}
}

func TestAuthService_Login(t *testing.T) {
	password := "testpassword"
	hashed, _ := bcrypt.GenerateFromPassword([]byte(password), bcrypt.MinCost)

	userRepo := &mockUserRepo{
		getByUsernameFn: func(ctx context.Context, username string) (*model.User, error) {
			return &model.User{
				ID:           "user-001",
				Username:     username,
				PasswordHash: string(hashed),
				Role:         model.RoleCommander,
				Status:       "active",
			}, nil
		},
	}
	svc := NewAuthService(userRepo, "test-secret")
	ctx := context.Background()

	resp, err := svc.Login(ctx, "commander1", password)
	if err != nil {
		t.Fatalf("Login failed: %v", err)
	}
	if resp.User.Username != "commander1" {
		t.Errorf("expected commander1, got %s", resp.User.Username)
	}
	if resp.Token == "" {
		t.Error("expected non-empty token")
	}
}

func TestAuthService_Login_WrongPassword(t *testing.T) {
	hashed, _ := bcrypt.GenerateFromPassword([]byte("correct"), bcrypt.MinCost)

	userRepo := &mockUserRepo{
		getByUsernameFn: func(ctx context.Context, username string) (*model.User, error) {
			return &model.User{
				ID:           "user-001",
				Username:     username,
				PasswordHash: string(hashed),
				Role:         model.RoleVictim,
				Status:       "active",
			}, nil
		},
	}
	svc := NewAuthService(userRepo, "test-secret")
	ctx := context.Background()

	_, err := svc.Login(ctx, "user1", "wrongpassword")
	if err == nil {
		t.Fatal("expected error for wrong password")
	}
}

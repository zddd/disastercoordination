package service

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"disaster-coordination/internal/middleware"
	"disaster-coordination/internal/model"
	"disaster-coordination/internal/repository"
)

// AuthService defines user authentication operations.
type AuthService interface {
	Register(ctx context.Context, req RegisterRequest) (*model.User, error)
	Login(ctx context.Context, username, password string) (*LoginResponse, error)
	GetMe(ctx context.Context, userID string) (*model.User, error)
}

// RegisterRequest is the input for user registration.
type RegisterRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
	Phone    string `json:"phone,omitempty"`
	Role     string `json:"role"`
}

// LoginResponse is returned on successful authentication.
type LoginResponse struct {
	Token string      `json:"token"`
	User  *model.User `json:"user"`
}

type authService struct {
	userRepo  repository.UserRepository
	jwtSecret string
}

func NewAuthService(userRepo repository.UserRepository, jwtSecret string) AuthService {
	return &authService{userRepo: userRepo, jwtSecret: jwtSecret}
}

// Register creates a new user account.
// Password is hashed with bcrypt before storage.
func (s *authService) Register(ctx context.Context, req RegisterRequest) (*model.User, error) {
	slog.InfoContext(ctx, "registering user", "username", req.Username, "role", req.Role)

	// Validate role
	role := model.Role(req.Role)
	if !role.IsValid() {
		return nil, fmt.Errorf("invalid role: %s", req.Role)
	}

	// Hash password with bcrypt
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("password hashing failed: %w", err)
	}

	now := time.Now()
	user := &model.User{
		ID:           uuid.New().String(),
		Username:     req.Username,
		PasswordHash: string(hashedPassword),
		Phone:        req.Phone,
		Role:         role,
		CreditScore:  100.0,
		Status:       "active",
		CreatedAt:    now,
		UpdatedAt:    now,
	}

	if err := s.userRepo.Create(ctx, user); err != nil {
		return nil, fmt.Errorf("create user failed: %w", err)
	}

	slog.InfoContext(ctx, "user registered", "user_id", user.ID, "username", user.Username, "role", user.Role)
	return user, nil
}

// Login authenticates a user and returns a JWT token.
func (s *authService) Login(ctx context.Context, username, password string) (*LoginResponse, error) {
	slog.InfoContext(ctx, "user login attempt", "username", username)

	user, err := s.userRepo.GetByUsername(ctx, username)
	if err != nil {
		return nil, fmt.Errorf("invalid username or password")
	}

	// Verify password
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		slog.WarnContext(ctx, "login failed — wrong password", "username", username)
		return nil, fmt.Errorf("invalid username or password")
	}

	if user.Status != "active" {
		return nil, fmt.Errorf("account is %s", user.Status)
	}

	// Generate JWT token
	token, err := middleware.GenerateToken(user.ID, string(user.Role), s.jwtSecret)
	if err != nil {
		return nil, fmt.Errorf("token generation failed: %w", err)
	}

	slog.InfoContext(ctx, "user logged in", "user_id", user.ID, "username", user.Username, "role", user.Role)

	return &LoginResponse{
		Token: token,
		User:  user,
	}, nil
}

// GetMe returns the current user's profile.
func (s *authService) GetMe(ctx context.Context, userID string) (*model.User, error) {
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("user not found: %w", err)
	}
	return user, nil
}

package middleware

import (
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const (
	// TokenExpiry is the default JWT token lifetime.
	TokenExpiry = 24 * time.Hour
)

// GenerateToken creates a JWT token for a given user with role claims.
// The token contains: sub (user_id), role, iat (issued at), exp (expires at).
// For rescue_team users, also includes team_id claim for task lookup.
func GenerateToken(userID, role, teamID string, secret string) (string, error) {
	now := time.Now()
	claims := jwt.MapClaims{
		"sub":  userID,
		"role": role,
		"iat":  now.Unix(),
		"exp":  now.Add(TokenExpiry).Unix(),
	}
	if teamID != "" {
		claims["team_id"] = teamID
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

// GenerateTokenWithExpiry creates a JWT token with a custom expiry duration.
func GenerateTokenWithExpiry(userID, role string, secret string, expiry time.Duration) (string, error) {
	now := time.Now()
	claims := jwt.MapClaims{
		"sub":  userID,
		"role": role,
		"iat":  now.Unix(),
		"exp":  now.Add(expiry).Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

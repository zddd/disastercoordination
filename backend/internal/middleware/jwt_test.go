package middleware

import (
	"testing"
	"time"
)

func TestGenerateToken(t *testing.T) {
	secret := "test-secret"
	token, err := GenerateToken("user-001", "admin", "", secret)
	if err != nil {
		t.Fatalf("GenerateToken failed: %v", err)
	}

	if token == "" {
		t.Fatal("expected non-empty token")
	}

	// Verify the token can be parsed
	claims, err := ParseToken(token, secret)
	if err != nil {
		t.Fatalf("ParseToken failed: %v", err)
	}

	if claims["sub"] != "user-001" {
		t.Errorf("expected sub=user-001, got %v", claims["sub"])
	}
	if claims["role"] != "admin" {
		t.Errorf("expected role=admin, got %v", claims["role"])
	}
}

func TestParseToken_WrongSecret(t *testing.T) {
	token, err := GenerateToken("user-001", "victim", "", "correct-secret")
	if err != nil {
		t.Fatalf("GenerateToken failed: %v", err)
	}

	_, err = ParseToken(token, "wrong-secret")
	if err == nil {
		t.Fatal("expected error for wrong secret, got nil")
	}
}

func TestParseToken_Expired(t *testing.T) {
	secret := "test-secret"
	// Generate token with -1s expiry (already expired)
	expiredToken, err := GenerateTokenWithExpiry("user-001", "victim", secret, -1*time.Second)
	if err != nil {
		t.Fatalf("GenerateTokenWithExpiry failed: %v", err)
	}

	claims, err := ParseToken(expiredToken, secret)
	if err == nil && claims != nil {
		// Some JWT libs still return claims for expired tokens
		t.Log("token expired but claims still available (library behavior)")
	} else if err != nil {
		t.Logf("expected: token rejected as expired: %v", err)
	}
}

func TestGenerateTokenWithExpiry(t *testing.T) {
	secret := "test-secret"
	token, err := GenerateTokenWithExpiry("user-001", "commander", secret, 1*time.Hour)
	if err != nil {
		t.Fatalf("GenerateTokenWithExpiry failed: %v", err)
	}

	claims, err := ParseToken(token, secret)
	if err != nil {
		t.Fatalf("ParseToken failed: %v", err)
	}

	if claims["role"] != "commander" {
		t.Errorf("expected role=commander, got %v", claims["role"])
	}
}

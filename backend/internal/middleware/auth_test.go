package middleware

import (
	"encoding/json"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func init() {
	gin.SetMode(gin.TestMode)
}

func TestAuth_ValidToken(t *testing.T) {
	secret := "test-secret-12345"
	token, err := GenerateToken("user-001", "rescue_team", secret)
	if err != nil {
		t.Fatalf("failed to generate token: %v", err)
	}

	router := gin.New()
	router.Use(Auth(secret))
	router.GET("/test", func(c *gin.Context) {
		userID, _ := c.Get("user_id")
		role, _ := c.Get("user_role")
		c.JSON(200, gin.H{"user_id": userID, "role": role})
	})

	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != 200 {
		t.Errorf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp map[string]string
	json.NewDecoder(w.Body).Decode(&resp)
	if resp["user_id"] != "user-001" {
		t.Errorf("expected user_id=user-001, got %s", resp["user_id"])
	}
	if resp["role"] != "rescue_team" {
		t.Errorf("expected role=rescue_team, got %s", resp["role"])
	}
}

func TestAuth_MissingHeader(t *testing.T) {
	router := gin.New()
	router.Use(Auth("secret"))
	router.GET("/test", func(c *gin.Context) { c.JSON(200, gin.H{}) })

	req := httptest.NewRequest("GET", "/test", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != 401 {
		t.Errorf("expected 401, got %d", w.Code)
	}
}

func TestAuth_InvalidToken(t *testing.T) {
	router := gin.New()
	router.Use(Auth("secret"))
	router.GET("/test", func(c *gin.Context) { c.JSON(200, gin.H{}) })

	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("Authorization", "Bearer invalid-token-here")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != 401 {
		t.Errorf("expected 401 for invalid token, got %d", w.Code)
	}
}

func TestAuth_ExpiredToken(t *testing.T) {
	secret := "test-secret"
	// Generate token that expires immediately
	token, err := GenerateTokenWithExpiry("user-001", "victim", secret, 0)
	if err != nil {
		t.Fatalf("failed to generate expired token: %v", err)
	}

	router := gin.New()
	router.Use(Auth(secret))
	router.GET("/test", func(c *gin.Context) { c.JSON(200, gin.H{}) })

	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != 401 {
		t.Errorf("expected 401 for expired token, got %d", w.Code)
	}
}

func TestAuth_InvalidFormat(t *testing.T) {
	router := gin.New()
	router.Use(Auth("secret"))
	router.GET("/test", func(c *gin.Context) { c.JSON(200, gin.H{}) })

	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("Authorization", "Basic abc123") // Wrong format
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != 401 {
		t.Errorf("expected 401, got %d", w.Code)
	}
}

func TestCORS_OptionsRequest(t *testing.T) {
	router := gin.New()
	router.Use(CORS())
	router.GET("/test", func(c *gin.Context) { c.JSON(200, gin.H{"ok": true}) })

	req := httptest.NewRequest("OPTIONS", "/test", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != 204 {
		t.Errorf("expected 204 for OPTIONS, got %d", w.Code)
	}

	// Verify CORS headers
	origin := w.Header().Get("Access-Control-Allow-Origin")
	if origin != "*" {
		t.Errorf("expected Access-Control-Allow-Origin=*, got %s", origin)
	}
}

func TestCORS_NormalRequest(t *testing.T) {
	router := gin.New()
	router.Use(CORS())
	router.GET("/test", func(c *gin.Context) { c.JSON(200, gin.H{"ok": true}) })

	req := httptest.NewRequest("GET", "/test", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != 200 {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

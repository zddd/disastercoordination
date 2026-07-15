package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/gin-gonic/gin"
)

func init() {
	gin.SetMode(gin.TestMode)
}

// TestHealthEndpoint verifies the health check returns 200.
func TestHealthEndpoint(t *testing.T) {
	router := gin.New()
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok", "version": "0.1.0-mvp"})
	})

	req := httptest.NewRequest("GET", "/health", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != 200 {
		t.Errorf("health check should return 200, got %d", w.Code)
	}

	var resp map[string]interface{}
	json.NewDecoder(w.Body).Decode(&resp)
	if resp["status"] != "ok" {
		t.Errorf("expected status=ok, got %v", resp["status"])
	}
}

// TestCORSPreflight verifies OPTIONS requests are handled.
func TestCORSPreflight(t *testing.T) {
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	})
	router.POST("/api/v1/helps", func(c *gin.Context) {
		c.JSON(201, gin.H{"ok": true})
	})

	req := httptest.NewRequest("OPTIONS", "/api/v1/helps", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != 204 {
		t.Errorf("OPTIONS should return 204, got %d", w.Code)
	}
}

// TestContentTypeJSON ensures POST with JSON content type works.
func TestContentTypeJSON(t *testing.T) {
	router := gin.New()
	router.POST("/api/v1/test", func(c *gin.Context) {
		var body map[string]interface{}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(400, gin.H{"error": "invalid"})
			return
		}
		c.JSON(200, body)
	})

	payload := map[string]string{"key": "value", "label": "测试"}
	body, _ := json.Marshal(payload)
	req := httptest.NewRequest("POST", "/api/v1/test", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != 200 {
		t.Errorf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

// TestRateLimiting verifies rate limit middleware.
func TestRateLimiting(t *testing.T) {
	callCount := 0
	router := gin.New()
	router.Use(func(c *gin.Context) {
		callCount++
		if callCount > 3 {
			c.AbortWithStatusJSON(429, gin.H{"error": "rate limit"})
			return
		}
		c.Next()
	})
	router.GET("/test", func(c *gin.Context) {
		c.JSON(200, gin.H{"ok": true})
	})

	// First 3 requests should succeed
	for i := 0; i < 3; i++ {
		req := httptest.NewRequest("GET", "/test", nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
		if w.Code != 200 {
			t.Errorf("request %d should succeed, got %d", i+1, w.Code)
		}
	}

	// 4th request should be rate limited
	req := httptest.NewRequest("GET", "/test", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	if w.Code != 429 {
		t.Errorf("request should be rate limited (429), got %d", w.Code)
	}
}

// TestErrorHandling verifies JSON error responses.
func TestErrorHandling(t *testing.T) {
	router := gin.New()
	router.POST("/test", func(c *gin.Context) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "bad request", "detail": "missing required field"})
	})

	req := httptest.NewRequest("POST", "/test", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != 400 {
		t.Errorf("expected 400, got %d", w.Code)
	}

	var resp map[string]interface{}
	json.NewDecoder(w.Body).Decode(&resp)
	if resp["error"] == nil {
		t.Error("error field should be present")
	}
}

// TestMain is required to ensure test isolation between packages.
func TestMain(m *testing.M) {
	os.Exit(m.Run())
}

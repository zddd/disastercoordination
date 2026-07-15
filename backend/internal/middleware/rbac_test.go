package middleware

import (
	"encoding/json"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestRequireRole_Allowed(t *testing.T) {
	router := gin.New()
	router.Use(func(c *gin.Context) {
		// Simulate Auth middleware
		c.Set("user_id", "user-001")
		c.Set("user_role", "admin")
		c.Next()
	})
	router.Use(RequireRole("admin"))
	router.GET("/admin-only", func(c *gin.Context) {
		c.JSON(200, gin.H{"ok": true})
	})

	req := httptest.NewRequest("GET", "/admin-only", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != 200 {
		t.Errorf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestRequireRole_Denied(t *testing.T) {
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("user_id", "user-001")
		c.Set("user_role", "victim")
		c.Next()
	})
	router.Use(RequireRole("admin"))
	router.GET("/admin-only", func(c *gin.Context) {
		c.JSON(200, gin.H{"ok": true})
	})

	req := httptest.NewRequest("GET", "/admin-only", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != 403 {
		t.Errorf("expected 403, got %d", w.Code)
	}
}

func TestRequireRole_MultipleAllowed(t *testing.T) {
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("user_id", "user-001")
		c.Set("user_role", "reviewer")
		c.Next()
	})
	// reviewer should be allowed for both reviewer and admin
	router.Use(RequireRole("admin", "commander", "reviewer"))
	router.GET("/staff", func(c *gin.Context) {
		c.JSON(200, gin.H{"ok": true})
	})

	req := httptest.NewRequest("GET", "/staff", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != 200 {
		t.Errorf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestRequireRole_NoAuth(t *testing.T) {
	router := gin.New()
	router.Use(RequireRole("admin"))
	router.GET("/admin-only", func(c *gin.Context) {
		c.JSON(200, gin.H{"ok": true})
	})

	req := httptest.NewRequest("GET", "/admin-only", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != 401 {
		t.Errorf("expected 401 when no auth, got %d", w.Code)
	}
}

func TestRequireRole_HierarchicalPermission(t *testing.T) {
	// Admin should have permission to any lower role
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("user_id", "admin-001")
		c.Set("user_role", "admin")
		c.Next()
	})
	router.Use(RequireRole("commander")) // Admin is above commander
	router.GET("/commander-area", func(c *gin.Context) {
		c.JSON(200, gin.H{"ok": true})
	})

	req := httptest.NewRequest("GET", "/commander-area", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != 200 {
		t.Errorf("expected 200 for hierarchical permission, got %d: %s", w.Code, w.Body.String())
	}
}

func TestGetRoleFromContext(t *testing.T) {
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Set("user_role", "commander")

	role := GetRoleFromContext(c)
	if role != "commander" {
		t.Errorf("expected commander, got %s", role)
	}
}

func TestGetRoleFromContext_Missing(t *testing.T) {
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	role := GetRoleFromContext(c)
	if role != "" {
		t.Errorf("expected empty string, got %s", role)
	}
}

func TestGetUserIDFromContext(t *testing.T) {
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Set("user_id", "user-123")

	id := GetUserIDFromContext(c)
	if id != "user-123" {
		t.Errorf("expected user-123, got %s", id)
	}
}

func TestRBAC_ErrorResponseIncludesRoleInfo(t *testing.T) {
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("user_id", "user-001")
		c.Set("user_role", "volunteer")
		c.Next()
	})
	router.Use(RequireRole("admin"))
	router.GET("/admin-only", func(c *gin.Context) {
		c.JSON(200, gin.H{"ok": true})
	})

	req := httptest.NewRequest("GET", "/admin-only", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	var resp map[string]interface{}
	json.NewDecoder(w.Body).Decode(&resp)

	// Response should include the user's actual role for debugging
	if resp["your_role"] != "volunteer" {
		t.Errorf("expected your_role=volunteer in error response, got %v", resp["your_role"])
	}
}

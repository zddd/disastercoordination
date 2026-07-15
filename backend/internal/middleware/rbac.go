package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"disaster-coordination/internal/model"
)

// RequireRole returns middleware that checks if the authenticated user has one of the
// required roles. Must be used after Auth middleware has set "user_role" in context.
// Supports hierarchical permissions via model.Role.HasPermission.
func RequireRole(roles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		roleVal, exists := c.Get("user_role")
		if !exists {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "authentication required"})
			return
		}

		userRole, ok := roleVal.(string)
		if !ok {
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "invalid role type"})
			return
		}

		for _, required := range roles {
			if userRole == required {
				c.Next()
				return
			}
			// Check hierarchical permission
			if model.Role(userRole).HasPermission(model.Role(required)) {
				c.Next()
				return
			}
		}

		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
			"error":       "insufficient permissions",
			"required":    roles,
			"your_role":   userRole,
		})
	}
}

// GetRoleFromContext extracts the user role from gin.Context.
// Returns empty string if not set.
func GetRoleFromContext(c *gin.Context) model.Role {
	role, exists := c.Get("user_role")
	if !exists {
		return ""
	}
	if r, ok := role.(string); ok {
		return model.Role(r)
	}
	return ""
}

// GetUserIDFromContext extracts the user ID from gin.Context.
// Returns empty string if not set.
func GetUserIDFromContext(c *gin.Context) string {
	userID, exists := c.Get("user_id")
	if !exists {
		return ""
	}
	if id, ok := userID.(string); ok {
		return id
	}
	return ""
}

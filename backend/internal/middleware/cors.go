// Package middleware provides HTTP middleware for the Gin framework.
package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// CORS enables cross-origin resource sharing for the frontend.
// In production, restrict AllowOrigin to the actual frontend domain.
func CORS() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization")
		c.Header("Access-Control-Max-Age", "86400") // Preflight cache: 24h

		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}

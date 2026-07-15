package middleware

import (
	"log/slog"
	"time"

	"github.com/gin-gonic/gin"
)

// Logger returns a middleware that logs each HTTP request using structured logging.
// Logged fields: method, path, status, duration, client_ip, user_id (if authenticated).
func Logger() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()

		// Process the request
		c.Next()

		// Collect log fields
		duration := time.Since(start)
		status := c.Writer.Status()

		attr := []slog.Attr{
			slog.String("method", c.Request.Method),
			slog.String("path", c.Request.URL.Path),
			slog.Int("status", status),
			slog.Duration("duration", duration),
			slog.String("client_ip", c.ClientIP()),
		}

		// Include user_id if authenticated
		if userID, exists := c.Get("user_id"); exists {
			attr = append(attr, slog.String("user_id", userID.(string)))
		}

		level := slog.LevelInfo
		if status >= 500 {
			level = slog.LevelError
		} else if status >= 400 {
			level = slog.LevelWarn
		}

		slog.LogAttrs(c.Request.Context(), level, "http_request", attr...)
	}
}

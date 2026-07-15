// Command server is the main entry point for the disaster-coordination API server.
//
// Architecture:
//   Gin HTTP Server → Handler Layer → Service Layer → Repository Layer → PostgreSQL
//
// MVP scope: single binary, single database instance. Full version extends with
// Redis caching, WebSocket upgrades, and microservice decomposition.
package main

import (
	"log/slog"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"

	"disaster-coordination/internal/config"
	"disaster-coordination/internal/handler"
	"disaster-coordination/internal/middleware"
)

func main() {
	// Initialize structured logger
	logLevel := parseLogLevel(os.Getenv("LOG_LEVEL"))
	slog.SetDefault(slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{
		Level: logLevel,
	})))

	slog.Info("starting disaster-coordination server", "version", "0.1.0-mvp")

	// Load configuration from environment
	cfg := config.Load()

	// Configure Gin mode based on environment
	if cfg.LogLevel == "debug" {
		gin.SetMode(gin.DebugMode)
	} else {
		gin.SetMode(gin.ReleaseMode)
	}

	// Create Gin engine with default recovery middleware
	r := gin.New()
	r.Use(gin.Recovery())

	// Initialize handlers
	// In full version, services and repositories would be wired here via dependency injection.
	// For MVP, handler initialization uses placeholder nil services (T3-T6 replace them).
	uploadHandler := handler.NewUploadHandler(cfg.UploadDir)
	helpHandler := handler.NewHelpHandler(nil) // Will be replaced when service layer is wired in T3

	// Global middleware chain
	r.Use(middleware.CORS())
	r.Use(middleware.Logger())
	r.Use(middleware.RateLimit(cfg.RateLimit))

	// Health check endpoint (no auth required)
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":  "ok",
			"version": "0.1.0-mvp",
		})
	})

	// API v1 router group
	v1 := r.Group("/api/v1")

	// ---- Public endpoints (no auth required) ----
	{
		// Authentication
		v1.POST("/auth/register", placeholderHandler("auth.register"))
		v1.POST("/auth/login", placeholderHandler("auth.login"))

		// Help request submission (public — victims can submit without login)
		v1.POST("/helps", helpHandler.Create)

		// Public status tracking
		v1.GET("/helps/:id/status", helpHandler.Status)

		// File upload (public — allows unauthenticated upload for emergency)
		v1.POST("/files/upload", uploadHandler.Upload)
	}
	// Also serve uploaded files publicly
	v1.GET("/files/:id", uploadHandler.ServeFile)

	// ---- Authenticated endpoints (JWT required) ----
	auth := v1.Group("")
	auth.Use(middleware.Auth(cfg.JWTSecret))
	{
		// User profile
		auth.GET("/auth/me", placeholderHandler("auth.me"))

		// Help requests (authenticated views)
		auth.GET("/helps/:id", helpHandler.Get)
		auth.GET("/helps/mine", helpHandler.ListMine)

		// Events SSE (subscriptions)
		auth.GET("/events/subscribe", placeholderHandler("events.subscribe"))

		// Rescue team endpoints
		auth.GET("/teams", placeholderHandler("teams.list"))
		auth.GET("/teams/nearby", placeholderHandler("teams.nearby"))
		auth.POST("/teams/register", placeholderHandler("teams.register"))
		auth.PUT("/teams/:id/location", placeholderHandler("teams.location"))

		// Task endpoints (rescue team operations)
		auth.GET("/tasks/mine", placeholderHandler("tasks.mine"))
		auth.GET("/tasks/:id", placeholderHandler("tasks.get"))
		auth.PUT("/tasks/:id/status", placeholderHandler("tasks.status"))
		auth.POST("/tasks/:id/reject", placeholderHandler("tasks.reject"))
	}

	// ---- Admin endpoints (role verification required) ----
	admin := auth.Group("")
	admin.Use(middleware.RequireRole("admin", "commander", "reviewer", "operator"))
	{
		// Disaster management
		admin.POST("/disasters", placeholderHandler("disasters.create"))
		admin.GET("/disasters", placeholderHandler("disasters.list"))
		admin.GET("/disasters/active", placeholderHandler("disasters.active"))
		admin.GET("/disasters/:id", placeholderHandler("disasters.get"))
		admin.PUT("/disasters/:id/close", placeholderHandler("disasters.close"))

		// Review operations
		admin.GET("/reviews/queue", placeholderHandler("reviews.queue"))
		admin.POST("/reviews/:id/approve", placeholderHandler("reviews.approve"))
		admin.POST("/reviews/:id/reject", placeholderHandler("reviews.reject"))
		admin.POST("/reviews/merge", placeholderHandler("reviews.merge"))

		// Dispatch operations
		admin.GET("/dispatch/pool", placeholderHandler("dispatch.pool"))
		admin.POST("/dispatch/assign", placeholderHandler("dispatch.assign"))
		admin.POST("/dispatch/batch-assign", placeholderHandler("dispatch.batch"))

		// Team management (admin only)
		admin.POST("/teams/:id/verify", placeholderHandler("teams.verify"))
		admin.POST("/teams/:id/reject", placeholderHandler("teams.reject"))
	}

	slog.Info("server starting",
		"port", cfg.Port,
		"log_level", cfg.LogLevel,
		"redis_enabled", cfg.RedisURL != "",
	)

	if err := r.Run(":" + cfg.Port); err != nil {
		slog.Error("failed to start server", "error", err)
		os.Exit(1)
	}
}

// placeholderHandler returns a Gin handler that responds with a message indicating
// the endpoint is registered but not yet implemented.
// Will be replaced with real handlers in T3-T6 tasks.
func placeholderHandler(name string) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"endpoint": name,
			"status":   "registered",
			"message":  "endpoint registered, implementation pending",
		})
	}
}

// parseLogLevel converts a string to slog.Level, defaulting to Info.
func parseLogLevel(s string) slog.Level {
	switch s {
	case "debug":
		return slog.LevelDebug
	case "warn":
		return slog.LevelWarn
	case "error":
		return slog.LevelError
	default:
		return slog.LevelInfo
	}
}

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

	// Initialize handlers with placeholder nil services.
	// Services will be wired in when T5-T6 complete the full dependency chain.
	uploadHandler := handler.NewUploadHandler(cfg.UploadDir)
	helpHandler := handler.NewHelpHandler(nil)
	disasterHandler := handler.NewDisasterHandler(nil)
	reviewHandler := handler.NewReviewHandler(nil)
	dispatchHandler := handler.NewDispatchHandler(nil)
	taskHandler := handler.NewTaskHandler(nil)
	authHandler := handler.NewAuthHandler(nil)
	teamHandler := handler.NewTeamHandler(nil)

	// SSE broker for real-time events (shared across handlers)
	sseBroker := handler.NewSSEBroker()
	sseHandler := handler.NewSSEHandler(sseBroker)

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
		v1.POST("/auth/register", authHandler.Register)
		v1.POST("/auth/login", authHandler.Login)

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
		auth.GET("/auth/me", authHandler.Me)

		// Help requests (authenticated views)
		auth.GET("/helps/:id", helpHandler.Get)
		auth.GET("/helps/mine", helpHandler.ListMine)

		// Events SSE (subscriptions)
		auth.GET("/events/subscribe", sseHandler.Subscribe)

		// Rescue team endpoints
		auth.GET("/teams", teamHandler.List)
		auth.GET("/teams/nearby", teamHandler.Nearby)
		auth.POST("/teams/register", teamHandler.Register)
		auth.PUT("/teams/:id/location", teamHandler.UpdateLocation)

		// Task endpoints (rescue team operations)
		auth.GET("/tasks/mine", taskHandler.ListMine)
		auth.GET("/tasks/:id", taskHandler.Get)
		auth.PUT("/tasks/:id/status", taskHandler.UpdateStatus)
		auth.POST("/tasks/:id/reject", taskHandler.Reject)
	}

	// ---- Admin endpoints (role verification required) ----
	admin := auth.Group("")
	admin.Use(middleware.RequireRole("admin", "commander", "reviewer", "operator"))
	{
		// Disaster management
		admin.POST("/disasters", disasterHandler.Create)
		admin.GET("/disasters", disasterHandler.List)
		admin.GET("/disasters/active", disasterHandler.Active)
		admin.GET("/disasters/:id", disasterHandler.Get)
		admin.PUT("/disasters/:id/close", disasterHandler.Close)

		// Review operations
		admin.GET("/reviews/queue", reviewHandler.Queue)
		admin.POST("/reviews/:id/approve", reviewHandler.Approve)
		admin.POST("/reviews/:id/reject", reviewHandler.Reject)
		admin.POST("/reviews/merge", reviewHandler.Merge)

		// Dispatch operations
		admin.GET("/dispatch/pool", dispatchHandler.Pool)
		admin.POST("/dispatch/assign", dispatchHandler.Assign)
		admin.POST("/dispatch/batch-assign", dispatchHandler.BatchAssign)

		// Team management (admin only)
		admin.POST("/teams/:id/verify", teamHandler.Verify)
		admin.POST("/teams/:id/reject", teamHandler.Reject)
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

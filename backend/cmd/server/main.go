// Command server is the main entry point for the disaster-coordination API server.
//
// Architecture (dependency injection chain):
//   Config → DB Connection → Repositories → Services → Handlers → Gin Router
//
// MVP scope: single binary, single database instance.
// Full version extends with Redis caching, WebSocket upgrades,
// and microservice decomposition while keeping interfaces unchanged.
package main

import (
	"log/slog"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"

	"disaster-coordination/internal/config"
	"disaster-coordination/internal/handler"
	"disaster-coordination/internal/middleware"
	"disaster-coordination/internal/repository"
	"disaster-coordination/internal/service"
)

func main() {
	// Initialize structured logger
	logLevel := parseLogLevel(os.Getenv("LOG_LEVEL"))
	slog.SetDefault(slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{
		Level: logLevel,
	})))

	slog.Info("starting disaster-coordination server", "version", "0.1.0-mvp")

	// ---- Step 1: Load configuration ----
	cfg := config.Load()

	if cfg.LogLevel == "debug" {
		gin.SetMode(gin.DebugMode)
	} else {
		gin.SetMode(gin.ReleaseMode)
	}

	slog.Info("configuration loaded",
		"port", cfg.Port,
		"redis_enabled", cfg.RedisURL != "",
	)

	// ---- Step 2: Initialize database connection ----
	// If DB is unavailable (e.g. local dev without Docker), server still starts
	// but returns errors for DB-dependent endpoints.
	db, dbErr := config.NewDB(cfg)
	if dbErr != nil {
		slog.Warn("database unavailable — server will start but DB endpoints will fail",
			"error", dbErr,
		)
	} else {
		defer db.Close()
	}

	// ---- Step 3: Build repository layer ----
	var repo *repository.Repository
	if db != nil {
		repo = repository.NewPostgresRepository(db)
		slog.Info("repositories initialized")
	}

	// ---- Step 4: Build service layer (inject repositories) ----
	var (
		helpSvc     service.HelpService
		disasterSvc service.DisasterService
		reviewSvc   service.ReviewService
		dispatchSvc service.DispatchService
		taskSvc     service.TaskService
		authSvc     service.AuthService
		teamSvc     service.TeamService
	)

	if repo != nil {
		helpSvc = service.NewHelpService(repo.Help, repo.Disaster)
		disasterSvc = service.NewDisasterService(repo.Disaster, repo.Task)
		reviewSvc = service.NewReviewService(repo.Help, repo.User)
		dispatchSvc = service.NewDispatchService(repo.Help, repo.Task, repo.Team)
		taskSvc = service.NewTaskService(repo.Task, repo.Help)
		authSvc = service.NewAuthService(repo.User, cfg.JWTSecret)
		teamSvc = service.NewTeamService(repo.Team)
		slog.Info("services initialized")
	} else {
		slog.Warn("services not initialized — database unavailable")
	}

	// ---- Step 5: Build handler layer (inject services) ----
	uploadHandler := handler.NewUploadHandler(cfg.UploadDir)
	helpHandler := handler.NewHelpHandler(helpSvc)
	disasterHandler := handler.NewDisasterHandler(disasterSvc)
	reviewHandler := handler.NewReviewHandler(reviewSvc)
	dispatchHandler := handler.NewDispatchHandler(dispatchSvc)
	taskHandler := handler.NewTaskHandler(taskSvc)
	authHandler := handler.NewAuthHandler(authSvc)
	teamHandler := handler.NewTeamHandler(teamSvc)

	// SSE broker for real-time events
	sseBroker := handler.NewSSEBroker()
	sseHandler := handler.NewSSEHandler(sseBroker)

	slog.Info("handlers initialized")

	// ---- Step 6: Build Gin router ----
	r := gin.New()
	r.Use(gin.Recovery())

	// Global middleware
	r.Use(middleware.CORS())
	r.Use(middleware.Logger())
	r.Use(middleware.RateLimit(cfg.RateLimit))

	// Health check
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":    "ok",
			"version":   "0.1.0-mvp",
			"db_ok":     db != nil,
		})
	})

	// API v1 router
	v1 := r.Group("/api/v1")

	// ---- Public endpoints (no auth) ----
	{
		v1.POST("/auth/register", authHandler.Register)
		v1.POST("/auth/login", authHandler.Login)
		v1.POST("/helps", helpHandler.Create)
		v1.GET("/helps/:id/status", helpHandler.Status)
		v1.POST("/files/upload", uploadHandler.Upload)
	}
	v1.GET("/files/:id", uploadHandler.ServeFile)

	// ---- Authenticated endpoints ----
	auth := v1.Group("")
	auth.Use(middleware.Auth(cfg.JWTSecret))
	{
		auth.GET("/auth/me", authHandler.Me)
		auth.GET("/helps/:id", helpHandler.Get)
		auth.GET("/helps/mine", helpHandler.ListMine)
		auth.GET("/events/subscribe", sseHandler.Subscribe)
		auth.GET("/teams", teamHandler.List)
		auth.GET("/teams/nearby", teamHandler.Nearby)
		auth.POST("/teams/register", teamHandler.Register)
		auth.PUT("/teams/:id/location", teamHandler.UpdateLocation)
		auth.GET("/tasks/mine", taskHandler.ListMine)
		auth.GET("/tasks/:id", taskHandler.Get)
		auth.PUT("/tasks/:id/status", taskHandler.UpdateStatus)
		auth.POST("/tasks/:id/reject", taskHandler.Reject)
	}

	// ---- Admin endpoints ----
	admin := auth.Group("")
	admin.Use(middleware.RequireRole("admin", "commander", "reviewer", "operator"))
	{
		admin.POST("/disasters", disasterHandler.Create)
		admin.GET("/disasters", disasterHandler.List)
		admin.GET("/disasters/active", disasterHandler.Active)
		admin.GET("/disasters/:id", disasterHandler.Get)
		admin.PUT("/disasters/:id/close", disasterHandler.Close)
		admin.GET("/reviews/queue", reviewHandler.Queue)
		admin.POST("/reviews/:id/approve", reviewHandler.Approve)
		admin.POST("/reviews/:id/reject", reviewHandler.Reject)
		admin.POST("/reviews/merge", reviewHandler.Merge)
		admin.GET("/dispatch/pool", dispatchHandler.Pool)
		admin.POST("/dispatch/assign", dispatchHandler.Assign)
		admin.POST("/dispatch/batch-assign", dispatchHandler.BatchAssign)
		admin.POST("/teams/:id/verify", teamHandler.Verify)
		admin.POST("/teams/:id/reject", teamHandler.Reject)
	}

	slog.Info("server starting",
		"port", cfg.Port,
		"log_level", cfg.LogLevel,
		"db_ok", db != nil,
	)

	if err := r.Run(":" + cfg.Port); err != nil {
		slog.Error("failed to start server", "error", err)
		os.Exit(1)
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

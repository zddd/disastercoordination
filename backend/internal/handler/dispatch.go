package handler

import (
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"

	"disaster-coordination/internal/middleware"
	"disaster-coordination/internal/service"
)

// DispatchHandler handles HTTP requests for rescue dispatch operations.
type DispatchHandler struct {
	svc service.DispatchService
}

func NewDispatchHandler(svc service.DispatchService) *DispatchHandler {
	return &DispatchHandler{svc: svc}
}

// Pool handles GET /api/v1/dispatch/pool — get the dispatch pool.
func (h *DispatchHandler) Pool(c *gin.Context) {
	disasterID := c.Query("disaster_id")
	if disasterID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "disaster_id is required"})
		return
	}

	pool, err := h.svc.GetPool(c.Request.Context(), disasterID)
	if err != nil {
		slog.Error("failed to get dispatch pool", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get dispatch pool"})
		return
	}

	// Compute counts
	criticalCount, normalCount, mildCount := 0, 0, 0
	for _, item := range pool {
		switch item.Urgency {
		case "critical":
			criticalCount++
		case "normal":
			normalCount++
		default:
			mildCount++
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"total":          len(pool),
		"critical_count": criticalCount,
		"normal_count":   normalCount,
		"mild_count":     mildCount,
		"items":          pool,
	})
}

// Assign handles POST /api/v1/dispatch/assign — assign a help request to a team.
func (h *DispatchHandler) Assign(c *gin.Context) {
	var req struct {
		HelpID string `json:"help_id"`
		TeamID string `json:"team_id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	if req.HelpID == "" || req.TeamID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "help_id and team_id are required"})
		return
	}

	commanderID := middleware.GetUserIDFromContext(c)

	task, err := h.svc.Assign(c.Request.Context(), req.HelpID, req.TeamID, commanderID)
	if err != nil {
		slog.Error("failed to assign task", "error", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, task)
}

// BatchAssign handles POST /api/v1/dispatch/batch-assign — batch assign helps to a team.
func (h *DispatchHandler) BatchAssign(c *gin.Context) {
	var req struct {
		HelpIDs []string `json:"help_ids"`
		TeamID  string   `json:"team_id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	if len(req.HelpIDs) == 0 || req.TeamID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "help_ids and team_id are required"})
		return
	}

	commanderID := middleware.GetUserIDFromContext(c)

	tasks, err := h.svc.BatchAssign(c.Request.Context(), req.HelpIDs, req.TeamID, commanderID)
	if err != nil {
		slog.Error("batch assign failed", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "batch assign failed"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"tasks": tasks,
		"count": len(tasks),
	})
}

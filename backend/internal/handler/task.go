package handler

import (
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"

	"disaster-coordination/internal/middleware"
	"disaster-coordination/internal/service"
)

// TaskHandler handles HTTP requests for rescue task lifecycle.
type TaskHandler struct {
	svc service.TaskService
}

func NewTaskHandler(svc service.TaskService) *TaskHandler {
	return &TaskHandler{svc: svc}
}

// ListMine handles GET /api/v1/tasks/mine — list tasks for the current team.
func (h *TaskHandler) ListMine(c *gin.Context) {
	teamID := c.Query("team_id")
	if teamID == "" {
		teamID = middleware.GetUserIDFromContext(c)
	}
	status := c.Query("status")

	tasks, err := h.svc.ListMine(c.Request.Context(), teamID, status)
	if err != nil {
		slog.Error("failed to list tasks", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list tasks"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"tasks": tasks, "count": len(tasks)})
}

// Get handles GET /api/v1/tasks/:id — get task details.
func (h *TaskHandler) Get(c *gin.Context) {
	taskID := c.Param("id")

	task, err := h.svc.GetByID(c.Request.Context(), taskID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "task not found"})
		return
	}

	c.JSON(http.StatusOK, task)
}

// UpdateStatus handles PUT /api/v1/tasks/:id/status — update task status.
// Validates transition against the task state machine.
func (h *TaskHandler) UpdateStatus(c *gin.Context) {
	taskID := c.Param("id")
	operatorID := middleware.GetUserIDFromContext(c)

	var req struct {
		Status string `json:"status"`
		Notes  string `json:"notes,omitempty"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	if req.Status == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "status is required"})
		return
	}

	task, err := h.svc.UpdateStatus(c.Request.Context(), taskID, req.Status, operatorID, req.Notes)
	if err != nil {
		slog.Error("failed to update task status", "task_id", taskID, "error", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, task)
}

// Reject handles POST /api/v1/tasks/:id/reject — reject a task.
func (h *TaskHandler) Reject(c *gin.Context) {
	taskID := c.Param("id")
	teamID := middleware.GetUserIDFromContext(c)

	var req struct {
		Reason string `json:"reason"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	if req.Reason == "" {
		req.Reason = "未提供原因"
	}

	if err := h.svc.Reject(c.Request.Context(), taskID, teamID, req.Reason); err != nil {
		slog.Error("failed to reject task", "task_id", taskID, "error", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "rejected"})
}

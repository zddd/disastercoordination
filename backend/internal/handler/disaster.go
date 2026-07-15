package handler

import (
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"

	"disaster-coordination/internal/middleware"
	"disaster-coordination/internal/service"
)

// DisasterHandler handles HTTP requests for disaster lifecycle management.
type DisasterHandler struct {
	svc service.DisasterService
}

func NewDisasterHandler(svc service.DisasterService) *DisasterHandler {
	return &DisasterHandler{svc: svc}
}

// Create handles POST /api/v1/disasters — create a new disaster instance.
// Requires admin or operator role.
func (h *DisasterHandler) Create(c *gin.Context) {
	var req service.CreateDisasterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body", "detail": err.Error()})
		return
	}

	// Validate required fields
	if req.Name == "" || req.Type == "" || req.Level == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name, type, and level are required"})
		return
	}

	req.CreatedBy = middleware.GetUserIDFromContext(c)

	disaster, err := h.svc.Create(c.Request.Context(), req)
	if err != nil {
		slog.Error("failed to create disaster", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create disaster"})
		return
	}

	c.JSON(http.StatusCreated, disaster)
}

// List handles GET /api/v1/disasters — list disasters with optional status filter.
func (h *DisasterHandler) List(c *gin.Context) {
	status := c.Query("status")

	disasters, err := h.svc.List(c.Request.Context(), status)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list disasters"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"disasters": disasters, "count": len(disasters)})
}

// Active handles GET /api/v1/disasters/active — get currently active disasters.
// Public info, used by help request form to show available disasters.
func (h *DisasterHandler) Active(c *gin.Context) {
	disasters, err := h.svc.ListActive(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list active disasters"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"disasters": disasters, "count": len(disasters)})
}

// Get handles GET /api/v1/disasters/:id — get disaster details.
func (h *DisasterHandler) Get(c *gin.Context) {
	id := c.Param("id")

	disaster, err := h.svc.GetByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "disaster not found"})
		return
	}

	c.JSON(http.StatusOK, disaster)
}

// Close handles PUT /api/v1/disasters/:id/close — close a disaster.
// Only commander or admin can close. Generates summary report.
func (h *DisasterHandler) Close(c *gin.Context) {
	id := c.Param("id")
	operatorID := middleware.GetUserIDFromContext(c)

	summary, err := h.svc.Close(c.Request.Context(), id, operatorID)
	if err != nil {
		slog.Error("failed to close disaster", "id", id, "error", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  "closed",
		"summary": summary,
	})
}

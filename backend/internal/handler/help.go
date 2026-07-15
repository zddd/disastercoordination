package handler

import (
	"log/slog"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"disaster-coordination/internal/middleware"
	"disaster-coordination/internal/model"
	"disaster-coordination/internal/service"
)

// HelpHandler handles HTTP requests for help/sos operations.
type HelpHandler struct {
	svc service.HelpService
}

// NewHelpHandler creates a HelpHandler with the given service.
func NewHelpHandler(svc service.HelpService) *HelpHandler {
	return &HelpHandler{svc: svc}
}

// Create handles POST /api/v1/helps
// Public endpoint — unauthenticated users (victims) can submit help requests.
// Accepts multipart/form-data or JSON body.
func (h *HelpHandler) Create(c *gin.Context) {
	var req service.CreateHelpRequest

	// Support both JSON and form-data
	contentType := c.GetHeader("Content-Type")
	if len(contentType) > 19 && contentType[:19] == "multipart/form-data" {
		req.DisasterID = c.PostForm("disaster_id")
		req.Category = c.PostForm("category")
		req.Urgency = c.PostForm("urgency")
		req.Description = c.PostForm("description")
		req.ContactName = c.PostForm("contact_name")
		req.Phone = c.PostForm("phone")
		req.DeviceID = c.PostForm("device_id")

		affectedCount, _ := strconv.Atoi(c.PostForm("affected_count"))
		if affectedCount > 0 {
			req.AffectedCount = affectedCount
		} else {
			req.AffectedCount = 1
		}

		lat, _ := strconv.ParseFloat(c.PostForm("latitude"), 64)
		lng, _ := strconv.ParseFloat(c.PostForm("longitude"), 64)
		req.Latitude = lat
		req.Longitude = lng
	} else {
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body", "detail": err.Error()})
			return
		}
	}

	// Set default urgency if not specified
	if req.Urgency == "" {
		req.Urgency = "normal"
	}
	// Set default affected count
	if req.AffectedCount <= 0 {
		req.AffectedCount = 1
	}

	// Try to get submitter ID if authenticated
	if userID := middleware.GetUserIDFromContext(c); userID != "" {
		req.SubmitterID = userID
	}

	// Validate required fields
	if req.DisasterID == "" || req.Category == "" || req.Description == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "disaster_id, category, and description are required"})
		return
	}
	if req.Latitude == 0 && req.Longitude == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "latitude and longitude are required"})
		return
	}

	help, err := h.svc.CreateHelp(c.Request.Context(), req)
	if err != nil {
		slog.ErrorContext(c.Request.Context(), "failed to create help request", "error", err)

		// Check if it's a duplicate submission
		if isDuplicateError(err) {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error(), "code": "duplicate"})
			return
		}

		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create help request"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"help_id":                help.ID,
		"status":                 help.Status,
		"tracking_url":           "/help/" + help.ID + "/status",
		"estimated_review_time":  formatReviewTime(model.EstimatedReviewTime(help.Urgency)),
	})
}

// Get handles GET /api/v1/helps/:id
// Requires authentication. Returns different data precision based on user role.
func (h *HelpHandler) Get(c *gin.Context) {
	helpID := c.Param("id")
	role := middleware.GetRoleFromContext(c)

	help, err := h.svc.GetHelp(c.Request.Context(), helpID, role)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "help request not found"})
		return
	}

	c.JSON(http.StatusOK, help)
}

// Status handles GET /api/v1/helps/:id/status
// Public endpoint — anyone can track a help request by ID.
// Only returns status and progress, no sensitive info.
func (h *HelpHandler) Status(c *gin.Context) {
	helpID := c.Param("id")

	status, err := h.svc.GetHelpStatus(c.Request.Context(), helpID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "help request not found"})
		return
	}

	c.JSON(http.StatusOK, status)
}

// ListMine handles GET /api/v1/helps/mine
// Requires authentication. Returns help requests submitted by current user.
func (h *HelpHandler) ListMine(c *gin.Context) {
	userID := middleware.GetUserIDFromContext(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "authentication required"})
		return
	}

	helps, err := h.svc.ListMine(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list help requests"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"helps": helps, "count": len(helps)})
}

// isDuplicateError checks if the error message indicates a duplicate submission.
func isDuplicateError(err error) bool {
	if err == nil {
		return false
	}
	msg := err.Error()
	return len(msg) > 9 && msg[:9] == "duplicate"
}

// formatReviewTime returns a human-readable review time estimate.
func formatReviewTime(minutes int) string {
	if minutes == 5 {
		return "5分钟内"
	}
	if minutes <= 30 {
		return "30分钟内"
	}
	return "2小时内"
}

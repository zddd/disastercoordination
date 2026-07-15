package handler

import (
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"

	"disaster-coordination/internal/service"
)

// ReviewHandler handles HTTP requests for the help request review workflow.
type ReviewHandler struct {
	svc service.ReviewService
}

func NewReviewHandler(svc service.ReviewService) *ReviewHandler {
	return &ReviewHandler{svc: svc}
}

// Queue handles GET /api/v1/reviews/queue — get the pending review queue.
// Sorted by urgency and waiting time. Includes SLA markers for the frontend.
func (h *ReviewHandler) Queue(c *gin.Context) {
	queue, err := h.svc.GetQueue(c.Request.Context(), 50)
	if err != nil {
		slog.Error("failed to get review queue", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get review queue"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"queue": queue,
		"count": len(queue),
	})
}

// Approve handles POST /api/v1/reviews/:id/approve — approve a help request.
func (h *ReviewHandler) Approve(c *gin.Context) {
	helpID := c.Param("id")

	// Reviewer ID comes from authenticated user
	reviewerID := c.GetString("user_id")

	if err := h.svc.Approve(c.Request.Context(), helpID, reviewerID); err != nil {
		slog.Error("failed to approve help request", "help_id", helpID, "error", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  "approved",
		"help_id": helpID,
	})
}

// Reject handles POST /api/v1/reviews/:id/reject — reject a help request.
func (h *ReviewHandler) Reject(c *gin.Context) {
	helpID := c.Param("id")
	reviewerID := c.GetString("user_id")

	var req struct {
		Reason string `json:"reason"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		req.Reason = "未提供原因"
	}

	if err := h.svc.Reject(c.Request.Context(), helpID, reviewerID, req.Reason); err != nil {
		slog.Error("failed to reject help request", "help_id", helpID, "error", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  "rejected",
		"help_id": helpID,
	})
}

// Merge handles POST /api/v1/reviews/merge — merge duplicate help requests.
func (h *ReviewHandler) Merge(c *gin.Context) {
	var req struct {
		PrimaryID    string   `json:"primary_id"`
		DuplicateIDs []string `json:"duplicate_ids"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	if req.PrimaryID == "" || len(req.DuplicateIDs) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "primary_id and duplicate_ids are required"})
		return
	}

	reviewerID := c.GetString("user_id")

	if err := h.svc.Merge(c.Request.Context(), req.PrimaryID, req.DuplicateIDs, reviewerID); err != nil {
		slog.Error("failed to merge help requests", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to merge"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "merged",
	})
}

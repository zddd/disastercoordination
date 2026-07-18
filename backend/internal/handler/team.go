package handler

import (
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"

	"disaster-coordination/internal/service"
)

// TeamHandler handles HTTP requests for rescue team management.
type TeamHandler struct {
	svc service.TeamService
}

func NewTeamHandler(svc service.TeamService) *TeamHandler {
	return &TeamHandler{svc: svc}
}

// Register handles POST /api/v1/teams/register.
func (h *TeamHandler) Register(c *gin.Context) {
	var req service.RegisterTeamRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	if req.Name == "" || req.Type == "" || req.ContactPhone == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name, type, and contact_phone are required"})
		return
	}

	team, err := h.svc.Register(c.Request.Context(), req)
	if err != nil {
		slog.Error("team registration failed", "error", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, team)
}

// List handles GET /api/v1/teams.
func (h *TeamHandler) List(c *gin.Context) {
	teams, err := h.svc.List(c.Request.Context())
	if err != nil {
		slog.Error("failed to list rescue teams",
			"error", err,
			"user_id", c.GetString("user_id"),
			"user_role", c.GetString("user_role"),
		)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list teams"})
		return
	}

	slog.Debug("rescue teams listed",
		"count", len(teams),
		"user_id", c.GetString("user_id"),
	)

	c.JSON(http.StatusOK, gin.H{"teams": teams, "count": len(teams)})
}

// Nearby handles GET /api/v1/teams/nearby.
func (h *TeamHandler) Nearby(c *gin.Context) {
	// In full implementation, parse lat/lng/radius from query params
	// For MVP, returns all active teams
	teams, err := h.svc.List(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to find nearby teams"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"teams": teams, "count": len(teams)})
}

// Verify handles POST /api/v1/teams/:id/verify.
func (h *TeamHandler) Verify(c *gin.Context) {
	teamID := c.Param("id")
	reviewerID := c.GetString("user_id")

	if err := h.svc.Verify(c.Request.Context(), teamID, reviewerID); err != nil {
		slog.Error("team verify failed", "team_id", teamID, "error", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "verified", "team_id": teamID})
}

// Reject handles POST /api/v1/teams/:id/reject.
func (h *TeamHandler) Reject(c *gin.Context) {
	teamID := c.Param("id")
	reviewerID := c.GetString("user_id")

	var req struct {
		Reason string `json:"reason"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	if err := h.svc.Reject(c.Request.Context(), teamID, reviewerID, req.Reason); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "rejected", "team_id": teamID})
}

// UpdateLocation handles PUT /api/v1/teams/:id/location.
func (h *TeamHandler) UpdateLocation(c *gin.Context) {
	teamID := c.Param("id")

	var req struct {
		Lat float64 `json:"lat"`
		Lng float64 `json:"lng"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	if err := h.svc.UpdateLocation(c.Request.Context(), teamID, req.Lat, req.Lng); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update location"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "updated"})
}

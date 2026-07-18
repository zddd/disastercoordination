package handler

import (
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"

	"disaster-coordination/internal/service"
)

// DashboardHandler handles HTTP requests for the admin dashboard.
// Provides a single aggregated stats endpoint that the frontend dashboard
// calls to get all overview data at once, reducing network round-trips.
type DashboardHandler struct {
	svc service.DashboardService
}

// NewDashboardHandler creates a DashboardHandler with the given service.
func NewDashboardHandler(svc service.DashboardService) *DashboardHandler {
	return &DashboardHandler{svc: svc}
}

// Stats handles GET /api/v1/admin/dashboard/stats.
// Returns aggregated statistics for the admin dashboard overview:
// disaster counts, help request breakdown, rescue team counts, and task statuses.
// Requires authentication + admin role (enforced at route level).
func (h *DashboardHandler) Stats(c *gin.Context) {
	stats, err := h.svc.GetStats(c.Request.Context())
	if err != nil {
		slog.Error("failed to get dashboard stats",
			"error", err,
			"user_id", c.GetString("user_id"),
			"user_role", c.GetString("user_role"),
		)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load dashboard stats"})
		return
	}

	slog.Debug("dashboard stats served",
		"user_id", c.GetString("user_id"),
		"total_helps", stats.TotalHelps,
		"total_teams", stats.TotalTeams,
	)

	c.JSON(http.StatusOK, stats)
}

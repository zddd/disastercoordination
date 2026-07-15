package model

import "time"

// DisasterType enumerates the categories of disasters the system handles.
type DisasterType string

const (
	DisasterEarthquake DisasterType = "earthquake"
	DisasterFlood      DisasterType = "flood"
	DisasterTyphoon    DisasterType = "typhoon"
	DisasterEpidemic   DisasterType = "epidemic"
	DisasterOther      DisasterType = "other"
)

// DisasterTypeLabel returns a Chinese label for a disaster type.
func DisasterTypeLabel(t DisasterType) string {
	switch t {
	case DisasterEarthquake:
		return "地震"
	case DisasterFlood:
		return "洪涝"
	case DisasterTyphoon:
		return "台风"
	case DisasterEpidemic:
		return "疫情"
	default:
		return "其他"
	}
}

// Disaster represents a disaster event managed by the system.
// The area_geom defines the affected region as a PostGIS POLYGON.
// disaster_id is used as a partition key across all related tables.
type Disaster struct {
	ID           string       `json:"id"`
	Name         string       `json:"name"`
	Type         DisasterType `json:"type"`
	Level        string       `json:"level"` // red, orange, yellow, blue
	Status       string       `json:"status"` // active, closed, archived
	Description  string       `json:"description,omitempty"`
	CreatedBy    string       `json:"created_by"`
	StartedAt    time.Time    `json:"started_at"`
	ClosedAt     *time.Time   `json:"closed_at,omitempty"`
	CreatedAt    time.Time    `json:"created_at"`
	UpdatedAt    time.Time    `json:"updated_at"`
}

// DisasterSummary is returned when a disaster is closed (design §12.7).
type DisasterSummary struct {
	DisasterID     string `json:"disaster_id"`
	TotalHelps     int    `json:"total_helps"`
	UniqueHelps    int    `json:"unique_helps"`
	CompletedTasks int    `json:"completed_tasks"`
	UnableTasks    int    `json:"unable_tasks"`
	PeopleRescued  int    `json:"people_rescued"`
	TeamsDeployed   int    `json:"teams_deployed"`
	DurationHours  float64 `json:"duration_hours"`
}

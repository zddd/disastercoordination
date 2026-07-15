package model

import "time"

// RescueTeam represents a rescue organization registered in the system.
// Supports both registered teams and civilian rescue forces (design §2.2).
// The type field distinguishes: "registered" vs "civil" (民间救援力量).
type RescueTeam struct {
	ID              string    `json:"id"`
	Name            string    `json:"name"`
	Type            string    `json:"type"`            // "registered" or "civil" (民间救援力量)
	Capabilities    []string  `json:"capabilities"`    // e.g. ["water", "mountain", "medical", "fire"]
	ContactPhone    string    `json:"contact_phone"`
	ContactPerson   string    `json:"contact_person,omitempty"`
	MemberCount     int       `json:"member_count"`
	Status          string    `json:"status"`          // active, inactive, suspended, pending
	Verified        bool      `json:"verified"`       // Whether the team has passed review
	CurrentLat      float64   `json:"current_lat"`
	CurrentLng      float64   `json:"current_lng"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

// TeamTypeLabel returns a Chinese label for team type.
func TeamTypeLabel(t string) string {
	switch t {
	case "registered":
		return "注册救援队"
	case "civil":
		return "民间救援力量"
	default:
		return t
	}
}

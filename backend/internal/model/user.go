package model

import "time"

// User represents a system user with role-based access control.
// The role field uses VARCHAR(30) for extensibility — new roles can be added
// in full version without schema migration.
type User struct {
	ID           string    `json:"id"`
	Username     string    `json:"username"`
	PasswordHash string    `json:"-"` // Never expose in API responses
	Phone        string    `json:"phone,omitempty"`
	Role         Role      `json:"role"`
	TeamID       string    `json:"team_id,omitempty"` // Link to rescue_teams for rescue_team role
	CreditScore  float64   `json:"credit_score"`
	Status       string    `json:"status"` // active, suspended
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

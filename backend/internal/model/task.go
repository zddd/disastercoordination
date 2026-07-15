package model

import "time"

// Task status constants forming the rescue task state machine.
// See design §3.3 for the full flow.
const (
	TaskStatusPending   = "pending"
	TaskStatusAssigned  = "assigned"
	TaskStatusAccepted  = "accepted"
	TaskStatusEnRoute   = "en_route"
	TaskStatusArrived   = "arrived"
	TaskStatusRescuing  = "rescuing"
	TaskStatusCompleted = "completed"
	TaskStatusUnable    = "unable"
	TaskStatusNeedBackup = "need_backup"
)

// ValidTaskTransitions defines the allowed state machine transitions.
// For example, a task cannot go directly from "pending" to "completed".
var ValidTaskTransitions = map[string][]string{
	TaskStatusPending:    {TaskStatusAssigned},
	TaskStatusAssigned:   {TaskStatusAccepted},
	TaskStatusAccepted:   {TaskStatusEnRoute, TaskStatusUnable},
	TaskStatusEnRoute:    {TaskStatusArrived},
	TaskStatusArrived:    {TaskStatusRescuing},
	TaskStatusRescuing:   {TaskStatusCompleted, TaskStatusUnable, TaskStatusNeedBackup},
	TaskStatusCompleted:  {}, // Terminal
	TaskStatusUnable:     {}, // Terminal
	TaskStatusNeedBackup: {TaskStatusAssigned}, // Back to pool for re-assignment
}

// IsValidTransition checks if a status transition is allowed by the state machine.
func IsValidTransition(from, to string) bool {
	targets, ok := ValidTaskTransitions[from]
	if !ok {
		return false
	}
	for _, t := range targets {
		if t == to {
			return true
		}
	}
	return false
}

// StatusHistoryEntry records a single status change event.
type StatusHistoryEntry struct {
	Status     string    `json:"status"`
	Timestamp  time.Time `json:"timestamp"`
	OperatorID string    `json:"operator_id"`
	Notes      string    `json:"notes,omitempty"`
}

// RescueTask represents a dispatch assignment linking a help request to a rescue team.
type RescueTask struct {
	ID            string               `json:"id"`
	HelpRequestID string               `json:"help_request_id"`
	TeamID        string               `json:"team_id"`
	DisasterID    string               `json:"disaster_id"`
	Status        string               `json:"status"`
	AssignedBy    string               `json:"assigned_by"` // Commander who assigned
	StatusHistory []StatusHistoryEntry `json:"status_history"`
	Notes         string               `json:"notes,omitempty"`
	AcceptedAt    *time.Time           `json:"accepted_at,omitempty"`
	CompletedAt   *time.Time           `json:"completed_at,omitempty"`
	CreatedAt     time.Time            `json:"created_at"`
	UpdatedAt     time.Time            `json:"updated_at"`
}

// TaskStatusLabel returns a Chinese label for task status.
func TaskStatusLabel(status string) string {
	switch status {
	case TaskStatusPending:
		return "待分配"
	case TaskStatusAssigned:
		return "已分配"
	case TaskStatusAccepted:
		return "已接单"
	case TaskStatusEnRoute:
		return "前往中"
	case TaskStatusArrived:
		return "已到达"
	case TaskStatusRescuing:
		return "施救中"
	case TaskStatusCompleted:
		return "已完成"
	case TaskStatusUnable:
		return "无法完成"
	case TaskStatusNeedBackup:
		return "需增援"
	default:
		return "未知"
	}
}

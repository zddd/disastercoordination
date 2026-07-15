package model

import "testing"

func TestIsValidTransition(t *testing.T) {
	tests := []struct {
		from   string
		to     string
		expect bool
	}{
		{TaskStatusPending, TaskStatusAssigned, true},
		{TaskStatusAssigned, TaskStatusAccepted, true},
		{TaskStatusAccepted, TaskStatusEnRoute, true},
		{TaskStatusEnRoute, TaskStatusArrived, true},
		{TaskStatusArrived, TaskStatusRescuing, true},
		{TaskStatusRescuing, TaskStatusCompleted, true},
		{TaskStatusRescuing, TaskStatusUnable, true},
		{TaskStatusRescuing, TaskStatusNeedBackup, true},

		// Invalid transitions
		{TaskStatusPending, TaskStatusCompleted, false}, // Can't skip states
		{TaskStatusCompleted, TaskStatusAccepted, false}, // Terminal state
		{TaskStatusUnable, TaskStatusRescuing, false},   // Terminal state
		{TaskStatusAccepted, TaskStatusCompleted, false}, // Must go through intermediate
		{"invalid", TaskStatusAssigned, false},           // Unknown from state
		{TaskStatusAssigned, "invalid", false},            // Unknown to state
	}

	for _, tt := range tests {
		result := IsValidTransition(tt.from, tt.to)
		if result != tt.expect {
			t.Errorf("IsValidTransition(%s, %s) = %v, want %v",
				tt.from, tt.to, result, tt.expect)
		}
	}
}

func TestTaskStatusLabel(t *testing.T) {
	tests := map[string]string{
		TaskStatusPending:    "待分配",
		TaskStatusAssigned:   "已分配",
		TaskStatusAccepted:   "已接单",
		TaskStatusEnRoute:    "前往中",
		TaskStatusArrived:    "已到达",
		TaskStatusRescuing:   "施救中",
		TaskStatusCompleted:  "已完成",
		TaskStatusUnable:     "无法完成",
		TaskStatusNeedBackup: "需增援",
		"unknown":            "未知",
	}

	for status, expected := range tests {
		got := TaskStatusLabel(status)
		if got != expected {
			t.Errorf("TaskStatusLabel(%s) = %s, want %s", status, got, expected)
		}
	}
}

func TestTeamTypeLabel(t *testing.T) {
	tests := map[string]string{
		"registered": "注册救援队",
		"civil":      "民间救援力量",
		"custom":     "custom", // Unknown type returns as-is
	}

	for typ, expected := range tests {
		got := TeamTypeLabel(typ)
		if got != expected {
			t.Errorf("TeamTypeLabel(%s) = %s, want %s", typ, got, expected)
		}
	}
}

func TestDisasterTypeLabel(t *testing.T) {
	tests := map[string]string{
		"earthquake": "地震",
		"flood":      "洪涝",
		"typhoon":    "台风",
		"epidemic":   "疫情",
		"other":      "其他",
	}

	for typ, expected := range tests {
		got := DisasterTypeLabel(DisasterType(typ))
		if got != expected {
			t.Errorf("DisasterTypeLabel(%s) = %s, want %s", typ, got, expected)
		}
	}
}

package model

import "testing"

func TestHelpCategoryLabel(t *testing.T) {
	tests := map[string]string{
		"trapped":       "被困",
		"injured":       "受伤",
		"collapse":      "倒塌",
		"missing":       "失联",
		"water_shortage": "缺水",
		"food_shortage": "缺食",
		"transfer":      "需要转移",
		"unknown":       "自定义",
	}

	for cat, expected := range tests {
		got := HelpCategoryLabel(cat)
		if got != expected {
			t.Errorf("HelpCategoryLabel(%s) = %s, want %s", cat, got, expected)
		}
	}
}

func TestUrgencyLabel(t *testing.T) {
	tests := map[string]string{
		"critical": "紧急",
		"normal":   "一般",
		"mild":     "轻微",
		"unknown":  "未知",
	}

	for urgency, expected := range tests {
		got := UrgencyLabel(urgency)
		if got != expected {
			t.Errorf("UrgencyLabel(%s) = %s, want %s", urgency, got, expected)
		}
	}
}

func TestEstimatedReviewTime(t *testing.T) {
	tests := map[string]int{
		"critical": 5,
		"normal":   30,
		"mild":     120,
		"unknown":  30, // default
	}

	for urgency, expected := range tests {
		got := EstimatedReviewTime(urgency)
		if got != expected {
			t.Errorf("EstimatedReviewTime(%s) = %d, want %d", urgency, got, expected)
		}
	}
}

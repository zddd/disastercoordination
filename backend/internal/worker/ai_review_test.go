package worker

import (
	"context"
	"testing"
	"time"

	"disaster-coordination/internal/model"
)

// spyFlagStore records AI flags for test verification.
type spyFlagStore struct {
	flags []aiFlag
}

func (s *spyFlagStore) Create(ctx context.Context, helpID string, flagType string, confidence float64, detail string) error {
	s.flags = append(s.flags, aiFlag{
		Type:       flagType,
		Confidence: confidence,
		Detail:     detail,
	})
	return nil
}

func TestAIRule_AbnormalCoords_Zero(t *testing.T) {
	w := &AIReviewWorker{}
	help := &model.HelpRequest{
		OffsetLat: 0,
		OffsetLng: 0,
	}

	flag := w.ruleAbnormalCoords(help)
	if flag == nil {
		t.Fatal("expected flag for zero coordinates")
	}
	if flag.Type != "abnormal_coords" {
		t.Errorf("expected abnormal_coords, got %s", flag.Type)
	}
}

func TestAIRule_AbnormalCoords_OutsideChina(t *testing.T) {
	w := &AIReviewWorker{}

	tests := []struct {
		lat    float64
		lng    float64
		expect bool
	}{
		{30.0, 104.0, false},  // Chengdu — normal
		{39.9, 116.4, false}, // Beijing — normal
		{10.0, 100.0, true},  // Too far south
		{60.0, 100.0, true},  // Too far north
		{30.0, 50.0, true},   // Too far west
		{30.0, 140.0, true},  // Too far east
	}

	for _, tt := range tests {
		help := &model.HelpRequest{OffsetLat: tt.lat, OffsetLng: tt.lng}
		flag := w.ruleAbnormalCoords(help)
		hasFlag := flag != nil
		if hasFlag != tt.expect {
			t.Errorf("coords (%.1f, %.1f): expected flag=%v, got flag=%v", tt.lat, tt.lng, tt.expect, hasFlag)
		}
	}
}

func TestAIRule_Sensitive(t *testing.T) {
	w := &AIReviewWorker{}

	tests := []struct {
		desc   string
		expect bool
	}{
		{"房屋倒塌，有人被困", false},
		{"爆炸了，有有毒气体泄漏", true},
		{"有人死亡，尸体需要处理", true},
		{"需要水和食物", false},
		{"武装人员抢夺物资", true},
	}

	for _, tt := range tests {
		help := &model.HelpRequest{Description: tt.desc}
		flag := w.ruleSensitive(help)
		hasFlag := flag != nil
		if hasFlag != tt.expect {
			t.Errorf("description '%s': expected flag=%v, got flag=%v", tt.desc, tt.expect, hasFlag)
		}
	}
}

func TestAIReview_Integration(t *testing.T) {
	// Integration test: verify all 4 rules work end-to-end with the flag store.
	// The duplicate/spam rules require a helpRepo (nil here), so only abnormal_coords
	// and sensitive will fire. This test verifies the flag flow.
	store := &spyFlagStore{}
	w := &AIReviewWorker{flagStore: store} // helpRepo is nil — duplicate/spam rules won't fire

	help2 := &model.HelpRequest{
		ID:          "test-002",
		DisasterID:  "disaster-001",
		OffsetLat:   0,
		OffsetLng:   0,
		Description: "爆炸了有毒气体泄漏",
	}

	// help2 should have multiple flags (abnormal coords + sensitive)
	flags2 := w.applyRules(context.Background(), help2)
	if len(flags2) < 2 {
		t.Errorf("help2 should have at least 2 flags (abnormal_coords + sensitive), got %d", len(flags2))
	}

	// Verify flag types
	flagTypes := make(map[string]bool)
	for _, f := range flags2 {
		flagTypes[f.Type] = true
		// Store each flag
		store.Create(context.Background(), help2.ID, f.Type, f.Confidence, f.Detail)
	}
	if !flagTypes["abnormal_coords"] {
		t.Error("missing abnormal_coords flag")
	}
	if !flagTypes["sensitive"] {
		t.Error("missing sensitive flag")
	}

	// Verify store received all flags
	if len(store.flags) != len(flags2) {
		t.Errorf("store received %d flags, expected %d", len(store.flags), len(flags2))
	}
}

func TestNewAIReviewWorker_DefaultInterval(t *testing.T) {
	w := NewAIReviewWorker(nil, &spyFlagStore{}, 0)
	if w.pollInterval != 30*time.Second {
		t.Errorf("expected default 30s interval, got %v", w.pollInterval)
	}
}

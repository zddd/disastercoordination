package model

import "testing"

func TestRole_HasPermission(t *testing.T) {
	tests := []struct {
		userRole      Role
		requiredRole  Role
		shouldHave    bool
	}{
		{RoleAdmin, RoleCommander, true},       // Higher role has lower role's permission
		{RoleAdmin, RoleAdmin, true},           // Same role
		{RoleCommander, RoleReviewer, true},    // Commander above reviewer
		{RoleReviewer, RoleCommander, false},   // Lower cannot access higher
		{RoleVictim, RoleAdmin, false},         // Victim cannot access admin
		{RoleRescueTeam, RoleCommander, false}, // Rescue team below commander
		{RoleAdmin, RoleVictim, true},          // Admin can access anyone
	}

	for _, tt := range tests {
		result := tt.userRole.HasPermission(tt.requiredRole)
		if result != tt.shouldHave {
			t.Errorf("%s.HasPermission(%s) = %v, want %v",
				tt.userRole, tt.requiredRole, result, tt.shouldHave)
		}
	}
}

func TestIsValid(t *testing.T) {
	if !RoleAdmin.IsValid() {
		t.Error("admin should be valid")
	}
	if !RoleVictim.IsValid() {
		t.Error("victim should be valid")
	}
	if Role("invalid_role").IsValid() {
		t.Error("invalid_role should not be valid")
	}
}

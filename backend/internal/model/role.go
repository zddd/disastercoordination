// Package model defines core domain types used across the application.
package model

// Role represents a user role in the system.
// New roles can be added without changing existing code thanks to VARCHAR storage.
type Role string

const (
	RoleAdmin         Role = "admin"
	RoleCommander     Role = "commander"
	RoleZoneCommander Role = "zone_commander" // 完整版: 分区指挥
	RoleReviewer      Role = "reviewer"
	RoleOperator      Role = "operator" // 值班员
	RoleRescueTeam    Role = "rescue_team"
	RoleVolunteer     Role = "volunteer" // 完整版: 志愿者
	RoleSupplyManager Role = "supply_manager" // 完整版: 物资管理员
	RoleDonor         Role = "donor" // 完整版: 捐赠者
	RoleVictim        Role = "victim" // 受灾群众
)

// AllRoles is an ordered list of roles by permission level (highest first).
// This ordering is used by HasPermission for hierarchical access control.
var AllRoles = []Role{
	RoleAdmin, RoleCommander, RoleZoneCommander, RoleReviewer, RoleOperator,
	RoleRescueTeam, RoleVolunteer, RoleSupplyManager, RoleDonor, RoleVictim,
}

// MVPEnabledRoles returns the roles that are active in the MVP phase.
func MVPEnabledRoles() []Role {
	return []Role{RoleAdmin, RoleCommander, RoleReviewer, RoleOperator, RoleRescueTeam, RoleVictim}
}

// HasPermission checks if role r has at least the permissions of required role.
// Roles earlier in AllRoles have higher privileges.
func (r Role) HasPermission(required Role) bool {
	rIdx, reqIdx := -1, -1
	for i, role := range AllRoles {
		if role == r {
			rIdx = i
		}
		if role == required {
			reqIdx = i
		}
	}
	return rIdx != -1 && reqIdx != -1 && rIdx <= reqIdx
}

// IsValid checks if the role string is a known role.
func (r Role) IsValid() bool {
	for _, role := range AllRoles {
		if role == r {
			return true
		}
	}
	return false
}
